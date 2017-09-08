const rollup = require('rollup');
const babel = require('rollup-plugin-babel');

rollup
    .rollup({
        entry: './src/index.js',
        external: ['uuid', 'mitt'],
        plugins: [
            babel({
                exclude: 'node_modules/**',
            }),
        ],
    })
    .then(bundle => {
        bundle.write({
            format: 'es',
            dest: 'dist/spine-high-templar.es.js',
        });
        bundle.write({
            format: 'umd',
            moduleId: 'spine-high-templar',
            moduleName: 'spineHighTemplar',
            dest: 'dist/spine-high-templar.umd.js',
            globals: {
                mitt: 'mitt',
                uuid: 'uuid',
            },
        });
    })
    .catch(err => {
        console.log(String(err));
        process.exit(1);
    });
