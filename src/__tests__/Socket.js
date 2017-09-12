import { Server, WebSocket } from 'mock-socket';
import S from '../Socket';

let mockServer = null;
const url = 'ws://app.test/ws/';

beforeEach(() => {
    mockServer = new Server(url);
});

afterEach(done => {
    mockServer.stop(done);
});


// We want to keep the socket closed
// until we say it can open.
class PendingWebSocket extends WebSocket {
    awake = false;
    set readyState(val) {
        if (val !== WebSocket.OPEN) {
            this._readyState = val;
            return;
        }
        if (!this.awake) {
            this._originalDispatchEvent = this.dispatchEvent;
            this.dispatchEvent = function(evt) {
                this._delayedEvent = evt;
            }
            return;
        }

        this._readyState = val;

        if (this._originalDispatchEvent && this._delayedEvent) {
            this.dispatchEvent = this._originalDispatchEvent;
            this.dispatchEvent(this._delayedEvent);
        }

    }

    get readyState() {
        return this._readyState;
    }

    wakeUp() {
        this.awake = true;
        this.readyState = WebSocket.OPEN;
    }
}

function retrieveGlobalObject() {
  if (typeof window !== 'undefined') {
    return window;
  }

  return typeof process === 'object' && typeof require === 'function' && typeof global === 'object' ? global : this;
}

class Socket extends S {
    constructor(props = {}) {
        props.url = url
        super(props);
    }
}

test('Should open a WebSocket successfully', done => {
    mockServer.on('connection', () => {
        done();
    });
    new Socket({});
});

test('Should accept a token option', done => {
    mockServer.stop();
    mockServer = new Server(url + '?token=foobar');
    mockServer.on('connection', () => {
        done();
    });
    new Socket({
        token: 'foobar',
    });
});


test('Should queue send actions until the socket has opened', done => {
    mockServer.stop();
    mockServer = new Server(url);
    const globalObject = retrieveGlobalObject();

    globalObject.WebSocket = PendingWebSocket;
    let fooReceived = false;

    setTimeout(function() {
        socket.instance.wakeUp();
    }, 250)

    mockServer.on('message', msg => {
        msg = JSON.parse(msg);
        if (!fooReceived) {
            expect(msg).toEqual({ type: 'foo' })
            fooReceived = true;
        }

        expect(msg).toEqual({ type: 'bar' })
        done()

    });
    const socket = new Socket();
    socket.send({ type: 'foo' });
    socket.send({ type: 'bar' });
})

test('Should receive a message as object', done => {
    mockServer.on('connection', server => {
        server.send(JSON.stringify({ foo: 'bar' }));
    });
    const socket = new Socket();
    socket.on('message', msg => {
        expect(msg).toEqual({ foo: 'bar' });
        done();
    })
});

test('Should send a message correctly', done => {
    mockServer.on('message', msg => {
        expect(msg).toEqual(
            JSON.stringify({
                type: 'foo',
            })
        );
        done()
    });
    const socket = new Socket();
    socket.send({ type: 'foo' });
});

test('Should send pings', done => {
    mockServer.on('message', msg => {
        expect(msg).toEqual('ping');
        mockServer.send('pong');
        done()
    });
    new Socket({
        pingInterval: 100,
    });
});

test('Should try to reconnect after a disconnect', done => {
    let count = 0;
    mockServer.on('connection', (server, ws) => {
        if (count > 0) {
            done();
        }
        ws.close();
        count += 1;
    });
    new Socket({
        reconnectInterval: 50,
    });
});

