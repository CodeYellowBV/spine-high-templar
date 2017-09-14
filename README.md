# spine-high-templar

[![Build Status](https://travis-ci.org/CodeYellowBV/spine-high-templar.svg?branch=master)](https://travis-ci.org/CodeYellowBV/spine-high-templar)
[![codecov](https://codecov.io/gh/CodeYellowBV/spine-high-templar/branch/master/graph/badge.svg)](https://codecov.io/gh/CodeYellowBV/spine-high-templar)
[![npm version](https://img.shields.io/npm/v/spine-high-templar.svg?style=flat)](https://www.npmjs.com/package/spine-high-templar)

A frontend package which adds websocket and pubSub logic from [high-templar](https://github.com/CodeYellowBV/high-templar) to [mobx-spine](https://github.com/CodeYellowBV/mobx-spine).

The functionality of this package includes:
- Websocket creation
- Keepalive
- Automatic reconnection
- Subscriptions
- Handlers for the publishes happening for a subscription
- Subscription refreshing after a socket disconnect => reconnect

## Usage

### Socket opening

spine-high-templar offers a Socket model. It is recommended to create this socket in the viewStore and save it in the api instance.

In the `store/View` constructor:
```js
this.fetchBootstrap().then(() => {
    if (this.bootstrapCode === 200) {
        api.socket = new Socket({
            url: process.env.CY_FRONTEND_WEBSOCKET_URL,
        });
    }
});
```

It is important that the bootstrap has actually succeeded, the high-templar instance will use the headers provided in the socket-open-request to authenticate the user against the binder instance.

### Subscribing & unsubscribing

The frontend subscribes to a room (in the form of an object). `onPublish` will be called with every message published in that room.

Don't forget to unsubscribe when a view will unmount.

View example:
```js
componentDidMount() {
    this.subscription = this.props.store.api.socket.subscribe({
        onPublish: this.handlePublish.bind(this),
        room: {
            tenant: 16,
            driver: this.props.screenProps.viewStore.currentUser.id,
        },
    });
}

handlePublish(msg) {
    this.props.store.add(msg.data);
}

componentWillUnmount() {
    this.props.store.api.socket.unsubscribe(this.subscription);
}
```

## Authorization: Token

If the app doesn't use session auth but an Authorization token, one can pass the token under the `token` key in the Socket constructor options. Due to a limitation of the WebSocket available in browsers, it's not possible to add custom headers to a websocket open request, so we handle this in high-templar.

The high-templar instance will add a header `Authorization: Token ${token}` when authenticating against the binder instance.

```js
api.socket = new Socket({
    url: WEBSOCKET_URL,
    token: this.authToken.value,
});
```
