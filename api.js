var fs = require('fs');
var cPath = '../coreos/certificates/';
var sslOptions = {
    key: fs.readFileSync(cPath + 'unsee.cc.key'),
    cert: fs.readFileSync(cPath + 'unsee.cc.crt')
};
var http = require('http');
var https = require('https');
var app = https.createServer(sslOptions).listen(3123);
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({server: app});
var sdk = require('./sdk.js');
var crypto = require('crypto');

try {
    var redis = require("redis");
    var redisCli = redis.createClient(6379, 'redis.unsee.cc', {detect_buffers: true, no_ready_check: true});
} catch (e) {
}


/**
 * Implement a functionality that would prevent broadcast
 * Maybe return false to disable it
 * Because when image is prepared in has to be broadcasted, not what user uploaded
 * Otherwise people would receive the unchanged source image
 *
 */


function getHash(str) {

    str = str || crypto.randomBytes(16);

    return crypto.createHash('md5').update(str).digest('hex');
}

sdk.Image.prototype.create = function (ws) {
    console.log('Creating new image', this.data.content.length);

    var message = this;


    var ip = ws.upgradeReq.connection.remoteAddress;

    var options = {
        host: '127.0.0.1',
        path: '/?watermarkText=' + ip,
        port: '1337',
        method: 'POST',
        encoding: 'binary'
    };

    callback = function (response) {
        var str = '';

        response.setEncoding('binary');

        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('end', function () {
            console.log('Received response from processor', str.length);
            message.setData('content', str);
            message.id = getHash();
            wss.broadcast(message);
        });
    };

    var req = http.request(options, callback);

    //This is the data we are posting, it needs to be a string or a buffer
    req.write(this.data.content, 'binary');
    req.end();

    return false;
};

sdk.Channel.prototype.remove = function (ws) {
    console.log('Deleting channel', this.id);

    delete ws.channels[this.id];
};
sdk.Channel.prototype.create = function (ws) {

    this.id = getHash();
    console.log('Creating channel', this.data);

    var message = this;

    var messageType = message.data.message_type;
    var album = message.data.album;
    var channel = {
        album: album,
        message_type: messageType,
        author: null
    };

    ws.channels[message.id] = channel;

    if (message.entity === 'Chat') {
        try {
            // Getting author of the album to be used by Chat messages
            redisCli.select(0, function () {
                redisCli.hget(album, 'sess', function (some, sess) {
                    if (sess) {
                        channel.author = sess.toString();
                        ws.channels[message.id].author = sess.toString();
                        message.setData('author', sess);
                        console.log('Found author of album', channel.album, channel.author);
                    }

                    // Forcing a response
                    ws.send(message.export());
                });
            });
        } catch (e) {
            console.log(e, 'error 2');
        }
    }

    ws.send(message.export());
};

// Chat API

sdk.Chat.prototype.getSessionColor = function (session) {
    return session.replace(/[^\d.]/g, '').substr(0, 6).match(/.{2}/g).join(',');
};

sdk.Chat.prototype.getSession = function (ws) {
    var ip = ws.upgradeReq.connection.remoteAddress;
    var ua = ws.upgradeReq.headers['user-agent'];
    return getHash(ua + ip);
};

sdk.Chat.prototype.create = function (ws) {
    if (!ws.channels[this.channel]) {
        console.log('The message channel does not exist', ws.channels);
        return false;
    }

    console.log('New message received');

    var channel = ws.channels[this.channel];
    var mySession = this.getSession(ws);

    this.setData('is_author', mySession === channel.author);
};

wss.broadcast = function broadcast(entity) {
    console.log('Broadcasting message ...');

    var payload = entity.export();

    wss.clients.forEach(function each(client) {
        if (!client.channels[entity.channel]) {
            // Client does not have this channel entity
            return false;
        }

        if (client.channels[entity.channel].message_type === entity.entity) {
            client.send(payload);
        } else {
            console.log('Clients channel has a wrong channel message type set', client.channels[entity.channel], entity.entity);
        }
    });
};

wss.on('connection', function (ws) {
    console.log('Opened connection');
    ws.channels = {};

    ws.on('message', function (data) {
        var mess = new sdk.Message();
        var entity = mess.getEntity(data);

        if (!entity) {
            return false;
        }

        if (entity.process(ws) !== false) {
            wss.broadcast(entity);
        }
    });

    ws.on('close', function () {
        console.log('Closed connection');
        ws.channels = {};
    });
});
