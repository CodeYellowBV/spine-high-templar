import { Server } from 'mock-socket';
import S from '../Socket';
import Store from '../Store';
import { Model, BinderApi } from 'mobx-spine';

class MyApi extends BinderApi {
    baseUrl = '/api/';
}

let mockServer = null;
let testStore = null;
const url = 'ws://app.test/ws/';
const room = { foo: 'bar' }
const api = new MyApi();

class TestModel extends Model {
    api = api;
}

class TestStore extends Store {
    Model = TestModel;
    api = api;
}



beforeEach(() => {
    mockServer = new Server(url);
    testStore = new TestStore();
});

afterEach(done => {
    mockServer.stop(done);
});

class Socket extends S {
    constructor(props = {}) {
        props.url = url
        super(props);
    }
}

test('Should send a subscribe message when subscribing', done => {
    let requestId = null;

    api.socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);
        expect(msg).toEqual({
            type: 'subscribe',
            requestId,
            room,
        })
        done()
    });

    requestId = testStore.subscribe({ room });
});

test('Should send an unsubscribe message when unsubscribing', done => {
    let requestId = null;
    let subscribeCalled = false;

    api.socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);

        if (msg.type === 'subscribe') {
            expect(msg).toEqual({
                type: 'subscribe',
                requestId,
                room,
            })
            subscribeCalled = true;
            return
        }

        expect(subscribeCalled).toBe(true);
        expect(msg).toEqual({
            type: 'unsubscribe',
            requestId,
        });
        done()
    });

    requestId = testStore.subscribe({ room });
    testStore.unsubscribe(requestId);
});
