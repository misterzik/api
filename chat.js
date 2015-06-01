var fs = require('fs');
var cPath = '/etc/ssl/';
var sslOptions = {
    key: fs.readFileSync(cPath + 'private/unsee.cc.key'),
    cert: fs.readFileSync(cPath + 'certs/unsee.cc.crt')
};
var app = require('https').createServer(sslOptions).listen(3000);
var io = require('socket.io')(app);
var crypto = require('crypto');

try {
    var redis = require("redis");
    var redisCli = redis.createClient(6379, 'redis.unsee.cc', {detect_buffers: true, no_ready_check: true});
} catch (e) {
}
var clientSess = '';

function getSession(socket) {
    var ip = socket.conn.remoteAddress;
    var ua = socket.client.request.headers['user-agent'];
    return crypto.createHash('md5').update(ua + ip).digest('hex');
}

io.on('connection', function (socket) {
    socket.on('hash', function (hash) {
        socket.join(hash);
        socket.emit('joined');
        socket.room = hash;

        try {
            io.to(socket.room).emit('number', Object.keys(io.sockets.adapter.rooms[socket.room]).length);
        } catch (e) {
        }

        try {
            redisCli.select(0, function () {
                redisCli.hgetall(hash, function (some, obj) {
                    if (!obj) {
                        return false;
                    }

                    socket.authorSess = obj.sess;
                });
            });
        } catch (e) {
            console.log(e);
        }
    });

    socket.on('message', function (ob) {
        var color = getSession(socket).replace(/[^\d.]/g, '').substr(0, 6).match(/.{2}/g).join(',');
        var resp = {text: ob.message, author: getSession(socket) === socket.authorSess, color: color};

        if (typeof ob.imageId === 'string') {
            resp.imageId = ob.imageId;
            resp.percentX = ob.percentX;
            resp.percentY = ob.percentY;
        }

        console.log(socket.room + '(' + Object.keys(io.sockets.adapter.rooms[socket.room]).length + '):', resp.text);
        io.to(socket.room).emit('message', resp);
    });

    socket.on('images_added', function (img_hash) {
        try {
            io.to(socket.room).emit('images_added', img_hash);
        } catch (e) {
            console.log(e);
        }
    });

    socket.on('disconnect', function () {
        try {
            io.to(socket.room).emit('number', Object.keys(io.sockets.adapter.rooms[socket.room]).length);
        } catch (e) {
        }
    });
});
