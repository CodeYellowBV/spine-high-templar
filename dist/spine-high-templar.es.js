import mitt from 'mitt';
import uuid from 'uuid/v1';

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var Socket = function () {
    function Socket() {
        var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        classCallCheck(this, Socket);
        this.instance = null;
        this.pingIntervalHandle = null;
        this.publishHandlers = {};
        this.pendingSendMessages = [];
        this.pingInterval = 30000;
        this.reconnectInterval = 2000;

        this._events = mitt();
        this.initialize(props);
    }

    createClass(Socket, [{
        key: 'initialize',
        value: function initialize(props) {
            var _this = this;

            var url = props.url;
            if (props.token) {
                url += '?token=' + props.token;
            }
            this.instance = new WebSocket(url);

            var _arr = ['pingInterval', 'reconnectInterval'];
            for (var _i = 0; _i < _arr.length; _i++) {
                var propName = _arr[_i];
                if (props[propName] !== undefined) {
                    this[propName] = props[propName];
                }
            }

            this.instance.onopen = function () {
                _this._events.emit('open');
                _this._sendPendingMessages();
                _this._initiatePingInterval();
            };

            this.instance.onclose = function () {
                _this._events.emit('close');
                _this._stopPingInterval();
                setTimeout(function () {
                    _this.initialize(props);
                }, _this.reconnectInterval);
            };

            this.instance.onmessage = function (evt) {
                if (evt.data === 'pong') {
                    return;
                }
                var msg = JSON.parse(evt.data);
                // console.log('[received]', msg);

                _this._events.emit('message', msg);
            };
        }
    }, {
        key: 'on',
        value: function on() {
            var _events;

            return (_events = this._events).on.apply(_events, arguments);
        }
    }, {
        key: 'off',
        value: function off() {
            var _events2;

            return (_events2 = this._events).off.apply(_events2, arguments);
        }
    }, {
        key: 'send',
        value: function send(options) {
            var msg = {
                type: options.type,
                data: options.data,
                room: options.room,
                requestId: options.requestId
            };
            // console.log('[sent]', msg);
            // Wait for a while if the socket is not yet done connecting...
            if (this.instance.readyState !== 1) {
                this.pendingSendMessages.push(msg);
                return;
            }

            this._sendDirectly(msg);
        }
    }, {
        key: 'subscribe',
        value: function subscribe(_ref) {
            var room = _ref.room,
                onPublish = _ref.onPublish;

            var requestId = uuid();

            if (onPublish) {
                this._addPublishHandler(requestId, onPublish);
            }

            this.send({
                type: 'subscribe',
                requestId: requestId,
                room: room
            });

            return requestId;
        }
    }, {
        key: 'unsubscribe',
        value: function unsubscribe(requestId) {
            this._removePublishHandler(requestId);
            this.send({
                type: 'unsubscribe',
                requestId: requestId
            });
        }
    }, {
        key: '_addPublishHandler',
        value: function _addPublishHandler(requestId, handler) {
            var wrappedHandler = function wrappedHandler(msg) {
                if (msg.requestId !== requestId || msg.type !== 'publish') {
                    return false;
                }
                handler(msg);
            };
            this.on('message', wrappedHandler);
            this.publishHandlers[requestId] = wrappedHandler;
        }
    }, {
        key: '_removePublishHandler',
        value: function _removePublishHandler(requestId) {
            var handler = this.publishHandlers[requestId];
            if (!handler) return;

            delete this.publishHandlers[requestId];
            this.off('message', handler);
        }
    }, {
        key: '_sendPendingMessages',
        value: function _sendPendingMessages() {
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = this.pendingSendMessages[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var msg = _step.value;

                    this._sendDirectly(msg);
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
        }
    }, {
        key: '_sendDirectly',
        value: function _sendDirectly(msg) {
            this.instance.send(JSON.stringify(msg));
        }
    }, {
        key: '_initiatePingInterval',
        value: function _initiatePingInterval() {
            var _this2 = this;

            this.pingIntervalHandle = setInterval(function () {
                _this2.instance.send('ping');
            }, this.pingInterval);
        }
    }, {
        key: '_stopPingInterval',
        value: function _stopPingInterval() {
            if (this.pingIntervalHandle) {
                clearInterval(this.pingIntervalHandle);
                this.pingIntervalHandle = null;
            }
        }
    }]);
    return Socket;
}();

export { Socket };
