var fs = require('fs');
var cPath = '../coreos/certificates/';
var sslOptions = {
    key: fs.readFileSync(cPath + 'unsee.cc.key'),
    cert: fs.readFileSync(cPath + 'unsee.cc.crt')
};
var app = require('https').createServer(sslOptions).listen(3123);
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({server: app});
var sdk = require('./sdk.js');

sdk.Image.prototype.create = function (ws) {
    console.log('Creating image', this.export());
    this.id = 'api.new.id';
};

sdk.Channel.prototype.create = function (ws) {
    console.log('Creating channel', this.data.name, 'in', this.id);

    if (typeof ws.channels[this.id] === 'undefined') {
        ws.channels[this.id] = [];
    }

    ws.channels[this.id].push(this.data.name);

    // Forcing a response
    ws.send(this.export());
};

wss.broadcast = function broadcast(entity) {
    wss.clients.forEach(function each(client) {

        if (!client.channels.hasOwnProperty(entity.entity)) {
            console.log('Client does not have this channel');
            return false;
        }

        if (!~client.channels[entity.entity].indexOf(entity.channel)) {
            console.log('Client is not subscribed to this message', entity.entity, entity.channel);
            return false;
        }

        console.log('Broadcasting message');

        // Send back as is
        var payload = entity.export();

        client.send(payload);
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

        entity.process(ws);

        wss.broadcast(entity);
    });

    ws.on('close', function () {
        console.log('Closed connection');
        ws.channels = {};
    });
});
