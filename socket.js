function Socket(url) {
    this.url = url;
    this.ws = null;
    this.queue = [];
    this.messageHandlers = {};
}

Socket.prototype.setHandlers = function () {
    var self = this;

    this.ws.onopen = function () {
        return self.open()
    };
    this.ws.onmessage = function (message) {
        return self.message(message)
    };
    this.ws.onclose = function () {
        return self.close()
    };
    this.ws.onerror = function () {
        return self.error()
    };
};

Socket.prototype.connect = function () {
    if (!this.url) {
        return false;
    }

    this.ws = new WebSocket(this.url);
    this.setHandlers();
};

Socket.prototype.open = function () {
    console.info('Connected');

    for (var i in this.queue) {
        this.send(this.queue[i]);
    }
};

Socket.prototype.message = function (e) {
    var message = new sdk.Message();
    var entity = message.getEntity(e.data);

    entity.process();
};

Socket.prototype.error = function () {
    console.error('Socket error!');
};

Socket.prototype.close = function () {
    console.info('Lost connection');
    var self = this;
    setTimeout(function () {
        self.connect(self.url)
    }, 1000);
};

Socket.prototype.send = function (message) {
    try {
        this.ws.send(message);
        console.log('Sending', JSON.parse(message));
        return true;
    } catch (e) {
        this.queue.push(message);
        console.error('Failed to send', message, e);
        return false;
    }
};
