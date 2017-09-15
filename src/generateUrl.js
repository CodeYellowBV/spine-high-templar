export default function(pathname) {
    const loc = window.location;
    let protocol;

    switch (loc.protocol) {
        case 'http:':
            protocol = 'ws://';
            break;
        case 'https:':
            protocol = 'wss://';
            break;
        default:
            throw new Error(`Unknown protocol ${protocol}`)
    }

    return `${protocol}${loc.host}${pathname}`;
}
