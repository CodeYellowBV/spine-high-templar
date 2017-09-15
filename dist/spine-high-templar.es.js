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







var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var Subscription = function () {
    function Subscription() {
        var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        classCallCheck(this, Subscription);
        this.room = null;
        this.socket = null;
        this.requestId = null;
        this.onPublish = null;
        this.onReconnect = null;
        this.wrappedPublishHandler = null;
        this.messageCached = true;

        this.room = props.room;
        this.onPublish = props.onPublish;
        this.onReconnect = props.onReconnect;
        this.socket = props.socket;
        this.requestId = uuid();
        this._start();
    }

    createClass(Subscription, [{
        key: '_start',
        value: function _start() {
            if (this.onPublish) {
                this._startListeningForPublish();
            }
            if (this.onReconnect) {
                this._startListeningForReconnect();
            }
        }
    }, {
        key: '_startListeningForPublish',
        value: function _startListeningForPublish() {
            var _this = this;

            this.wrappedPublishHandler = function (msg) {
                if (msg.requestId !== _this.requestId || msg.type !== 'publish') {
                    return false;
                }
                _this.onPublish(msg);
            };
            this.socket.on('message', this.wrappedPublishHandler);
        }
    }, {
        key: '_startListeningForReconnect',
        value: function _startListeningForReconnect() {
            var _this2 = this;

            this.wrappedReconnectHandler = function () {
                if (_this2.messageCached) {
                    return;
                }
                _this2.onReconnect();
            };
            this.socket.on('open', this.wrappedReconnectHandler);
        }
    }, {
        key: 'stopListening',
        value: function stopListening() {
            if (this.wrappedPublishHandler) {
                this.socket.off('message', this.wrappedPublishHandler);
            }
            if (this.wrappedReconnectHandler) {
                this.socket.off('open', this.wrappedReconnectHandler);
            }
        }
    }]);
    return Subscription;
}();

var Socket = function () {
    function Socket() {
        var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        classCallCheck(this, Socket);
        this.instance = null;
        this.pingIntervalHandle = null;
        this.subscriptions = [];
        this.pendingSendActions = [];
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

            ['pingInterval', 'reconnectInterval'].forEach(function (propName) {
                if (props[propName] !== undefined) {
                    _this[propName] = props[propName];
                }
            });

            this.instance.onopen = function () {
                _this._events.emit('open');
                _this._sendPendingMessages();
                _this._reconnectSubscriptions();
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
            // If the socket is not connected, push them onto a stack
            // which will pop when the socket connects.
            if (this.instance.readyState !== 1) {
                var resolveSend = null;
                var pSend = new Promise(function (resolve, reject) {
                    resolveSend = resolve;
                });
                this.pendingSendActions.push({
                    message: msg,
                    resolve: resolveSend
                });
                return pSend;
            }

            this._sendDirectly(msg);
            return Promise.resolve();
        }
    }, {
        key: 'subscribe',
        value: function subscribe(options) {
            var sub = new Subscription(_extends({ socket: this }, options));
            this.subscriptions.push(sub);
            this.notifySocketOfSubscription(sub).then(function () {
                sub.messageCached = false;
            });

            return sub;
        }
    }, {
        key: '_reconnectSubscriptions',
        value: function _reconnectSubscriptions() {
            var _this2 = this;

            this.subscriptions.forEach(function (sub) {
                if (sub.messageCached) {
                    return;
                }
                _this2.notifySocketOfSubscription(sub);
            });
        }
    }, {
        key: 'notifySocketOfSubscription',
        value: function notifySocketOfSubscription(sub) {
            return this.send({
                type: 'subscribe',
                requestId: sub.requestId,
                room: sub.room
            });
        }
    }, {
        key: 'unsubscribe',
        value: function unsubscribe(subscription) {
            subscription.stopListening();

            var subIndex = this.subscriptions.indexOf(subscription);
            this.subscriptions.splice(subIndex, 1);
            return this.send({
                type: 'unsubscribe',
                requestId: subscription.requestId
            });
        }
    }, {
        key: '_sendPendingMessages',
        value: function _sendPendingMessages() {
            var _this3 = this;

            this.pendingSendActions.forEach(function (action) {
                _this3._sendDirectly(action.message);
                action.resolve();
            });
            this.pendingSendActions = [];
        }
    }, {
        key: '_sendDirectly',
        value: function _sendDirectly(msg) {
            this.instance.send(JSON.stringify(msg));
        }
    }, {
        key: '_initiatePingInterval',
        value: function _initiatePingInterval() {
            var _this4 = this;

            this.pingIntervalHandle = setInterval(function () {
                _this4.instance.send('ping');
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
    }, {
        key: 'pendingSendMessages',
        get: function get$$1() {
            return this.pendingSendActions.map(function (a) {
                return a.message;
            });
        }
    }]);
    return Socket;
}();

var generateUrl = function (pathname) {
    var loc = window.location;
    var protocol = void 0;

    switch (loc.protocol) {
        case 'http:':
            protocol = 'ws://';
            break;
        case 'https:':
            protocol = 'wss://';
            break;
        default:
            throw new Error('Unknown protocol ' + protocol);
    }

    return '' + protocol + loc.host + pathname;
};

export { Socket, Subscription, generateUrl };
