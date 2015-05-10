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
var stream = require('stream')

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

sdk.Image.prototype.send = function (host, port, path, method, data, cb) {

    // An object of options to indicate where to post to
    var options = {
        host: host,
        port: port,
        path: path,
        method: method,
        encoding: 'binary'
    };

    var message = this;

    // Set up the request + callback
    var req = http.request(options, function (response) {
        var str = '';

        response.setEncoding('binary');

        response.on('data', function (chunk) {
            str += chunk;
        });

        cb && response.on('end', function () {
            cb.bind(message)(str);
        });
    });

    if (data) {
        req.write(data, 'binary');
    }

    req.end();
};

sdk.Image.prototype.create = function () {
    this.id = getHash();
    var message = this;

    console.log('Creating new image', this.data.content.length, this.id);

    // Save image to storage
    this.send('proxy.unsee.cc', 8080, '/' + this.id, 'PUT', this.data.content, this.uploadHandler);

    return false;
};

sdk.Image.prototype.uploadHandler = function (str) {
    console.log('Received response from S3 ', str);

    var ip = this.ws.upgradeReq.connection.remoteAddress;
    var id = this.id;

    // Create an image record
    redisCli.select(1, function () {
        redisCli.hset(this.id, 'width', 800);
        redisCli.hset(this.id, 'height', 600);
        redisCli.hset(this.id, 'weight', this.data.content.length);
    }.bind(this));

    var album = this.ws.channels[this.channel].album;

    // Add an image to the images list in an album
    redisCli.select(2, function () {
        redisCli.zcount(album, '-inf', '+inf', function (err, res) {
            redisCli.zadd(album, parseInt(res) + 1, this.id);
        }.bind(this));
    }.bind(this));

    // Apply image processing
    this.send('127.0.0.1', 1337, '/?watermarkText=' + ip, 'PUT', this.data.content, this.processHandler);
};

sdk.Image.prototype.processHandler = function (str) {
    console.log('Received response from processor', str.length);
    this.setData('content', str);
    wss.broadcast(this);
};

sdk.Image.prototype.fetchHandler = function (str) {
    console.log('Received response from processor', str.length);
    this.setData('content', str);
    wss.broadcast(this);
};

sdk.Channel.prototype.remove = function () {
    console.log('Deleting channel', this.id);

    delete this.ws.channels[this.id];
};
sdk.Channel.prototype.create = function () {

    this.id = getHash();
    console.log('Creating channel', this.data);

    var message = this;
    var ws = this.ws;
    var messageType = message.data.message_type;
    var album = message.data.album;
    var channel = {
        album: album,
        message_type: messageType,
        author: null
    };

    ws.channels[message.id] = channel;

    if (messageType === 'Chat') {
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
    } else if(messageType === 'Image') {
        ws.send(message.export());

        // Get already available images and push them to the channel
        //ZRANGE album_id 0 9
        redisCli.select(2, function (err, res) {
            redisCli.zrange(album, 0, 99, function (err, res) {
                res.forEach(function (imageId) {
                    console.log('Requesting', imageId);
                    sdk.Image.prototype.send('proxy.unsee.cc', 8080, '/' + imageId, 'GET', null, function (res) {
                        if (res) {

                            if (res.substr(0, 5) === '<?xml') {
                                console.log('Got error', res);
                                return false;
                            }

                            console.log('Got image!', res.length);

                            // Create an image message
                            var im = new sdk.Image();
                            im.setId(imageId);
                            im.setData('content', res);
                            im.setAction('create');

                            // Broadcast it to the channel
                            wss.broadcast(im);
                        }
                    }.bind(this));
                }.bind(this));
            }.bind(this));
        }.bind(this));
    }
};

// Chat API

sdk.Chat.prototype.getSessionColor = function (session) {
    return session.replace(/[^\d.]/g, '').substr(0, 6).match(/.{2}/g).join(',');
};

sdk.Chat.prototype.getSession = function () {
    var ip = this.ws.upgradeReq.connection.remoteAddress;
    var ua = this.ws.upgradeReq.headers['user-agent'];
    return getHash(ua + ip);
};

sdk.Chat.prototype.create = function () {
    if (!this.ws.channels[this.channel]) {
        console.log('The message channel does not exist', this.ws.channels);
        return false;
    }

    console.log('New message received');

    var channel = this.ws.channels[this.channel];
    var mySession = this.getSession();

    this.setData('is_author', mySession === channel.author);
};

wss.broadcast = function broadcast(entity) {
    console.log('Broadcasting message ...');

    var payload = entity.export();

    wss.clients.forEach(function each(client) {

        for (var c in client.channels) {
            var channel = client.channels[c];

            if (channel.message_type === entity.entity) {
                client.send(payload);
            } else {
                console.log('Not sending message of type', entity.entity, 'to', channel.message_type);
            }
        }

        return false;


        client.channels.forEach(function (channel) {


            if (channel.message_type === entity.entity) {
                client.send(payload);
            } else {
                console.log('Clients channel has a wrong channel message type set', client.channels[entity.channel], entity.entity);
            }
        });
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

        entity.ws = ws;

        if (entity.process() !== false) {
            wss.broadcast(entity);
        }
    });

    ws.on('close', function () {
        console.log('Closed connection');
        ws.channels = {};
    });
});
