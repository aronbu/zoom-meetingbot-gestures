// webpack.config.js
const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const NodemonWebpackPlugin = require('nodemon-webpack-plugin');
const DotenvPlugin = require('dotenv-webpack');
// ADD:
const nodeExternals = require('webpack-node-externals');

module.exports = [
    {
        name: 'frontend',
        entry: path.join(__dirname, 'frontend/index.js'),
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                    },
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'],
                },
            ],
        },
        resolve: {
            extensions: ['*', '.js', '.jsx'],
            fallback: {
                crypto: require.resolve('crypto-browserify'),
                stream: require.resolve('stream-browserify'),
                vm: require.resolve('vm-browserify'),
            },
        },
        output: {
            path: path.resolve(__dirname, 'dist/frontend'),
            filename: 'bundle.js',
            publicPath: '/',
        },
        plugins: [
            new webpack.HotModuleReplacementPlugin(),
            new CopyWebpackPlugin({
                patterns: [{ from: 'frontend/static' }],
            }),
        ],
        devServer: {
            port: 3001,
            proxy: [
                {
                    context: ['/auth', '/api', '/webhook', '/install'],
                    target: 'http://localhost:3000',
                },
            ],
            headers: {
                'Content-Security-Policy':
                    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
                'Strict-Transport-Security':
                    'max-age=31536000; includeSubDomains',
                'X-Content-Type-Options': 'nosniff',
                'Referrer-Policy': 'same-origin',
            },
            allowedHosts: ['.ngrok.io', '.ngrok-free.app'],
            hot: true,
            client: {
                overlay: {
                    errors: true,
                    warnings: false,
                    runtimeErrors: true,
                },
            },
        },
    },
    {
        name: 'server',
        entry: path.join(__dirname, 'server/index.js'),
        target: 'node',
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                    },
                },
            ],
        },
        /*
          For server side with tfjs-node, typically you do NOT want to polyfill
          core node modules (like fs) to false. Because @tensorflow/tfjs-node
          will read files from disk to load the model.
          Remove or comment out if it conflicts with model loading:
        */
        resolve: {
            fallback: {
                // Keep these commented if @tensorflow/tfjs-node or 'sharp' need them:
                // fs: false,
                // path: false,
            },
        },
        externals: [
            nodeExternals({
                // If there's something you DO want to bundle from node_modules,
                // put it in allowlist: [/^@someorg\/somepackage/]
                allowlist: [],
            }),
        ],
        output: {
            path: path.resolve(__dirname, 'dist/server'),
            filename: 'bundle.js',
        },
        plugins: [
            new DotenvPlugin({
                path: './server/.env',
            }),
            new NodemonWebpackPlugin({}),
        ],
    },
];
