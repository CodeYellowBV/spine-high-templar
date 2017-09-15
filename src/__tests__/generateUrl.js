import generateUrl from '../generateUrl';

test('Should use ws:// for http://', () => {
    Object.defineProperty(window.location, 'host', {
        writable: true,
        value: 'app.test',
    })
    Object.defineProperty(window.location, 'protocol', {
        writable: true,
        value: 'http:',
    })

    expect(generateUrl('/ws/')).toEqual('ws://app.test/ws/');
});

test('Should use wss:// for https://', () => {
    Object.defineProperty(window.location, 'host', {
        writable: true,
        value: 'production.app.com',
    })
    Object.defineProperty(window.location, 'protocol', {
        writable: true,
        value: 'https:',
    })

    expect(generateUrl('/ws/')).toEqual('wss://production.app.com/ws/');
});

test('Should throw if no window context', () => {
    Object.defineProperty(window.location, 'protocol', {
        writable: true,
        value: 'about:',
    })
    expect(() => {
        generateUrl('/ws/');
    }).toThrow();
});
