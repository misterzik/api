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

sdk.Message.prototype.create = function () {
    console.log('Creating not implemented', this.data);
    return null;
};
sdk.Message.prototype.modify = function () {
    console.log('Modification not implemented', this.data);
};
sdk.Message.prototype.remove = function () {
    console.log('Deletion not implemented', this.data);
};

sdk.Message.prototype.process = function () {
    if (this.id === null) {
        this.id = this.create();
    } else if (this.data === null) {
        this.remove();
    } else {
        this.modify();
    }
};

wss.on('connection', function (ws) {
    ws.on('message', function (data) {
        var mess = new sdk.Message();
        var entity = mess.getEntity(data);
        entity.process();
        entity.send(ws);
    });

    ws.on('close', function () {
        console.log('Closed connection');
    });
});
