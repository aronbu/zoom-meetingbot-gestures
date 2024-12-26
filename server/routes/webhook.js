import express from 'express';
import crypto from 'crypto';
import { handleError, sanitize } from '../helpers/routing.js';
import { zoomApp } from '../config.js';
import db from '../helpers/database.js';
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const wss = new WebSocket.Server({ port: 8765 });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        console.log('Received message', message);
        if (typeof message === 'string') {
            console.log(message);
        } else {
            const streamId = message.readUInt32LE(0);
            const timestamp = message.readUInt32LE(4);
            const filePath = path.join(
                __dirname,
                'output',
                `${streamId}-${timestamp}.png`
            );

            fs.writeFile(filePath, message.slice(8), (err) => {
                if (err) {
                    console.error('Error writing file:', err);
                } else {
                    console.log('Wrote message to', filePath);
                }
            });
        }
    });
});

console.log('WebSocket server is running on ws://0.0.0.0:8765');

/*
 * Receives transcription webhooks from the Recall Bot
 * @see https://recallai.readme.io/reference/webhook-reference#real-time-transcription
 */
router.post('/transcription', async (req, res, next) => {
    try {
        sanitize(req);

        if (
            !crypto.timingSafeEqual(
                Buffer.from(req.query.secret, 'utf8'),
                Buffer.from(zoomApp.webhookSecret, 'utf8')
            )
        ) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log('transcription webhook received: ', req.body);

        const { bot_id, transcript } = req.body.data;

        if (!db.transcripts[bot_id]) {
            db.transcripts[bot_id] = [];
        }

        db.transcripts[bot_id].push(transcript);
        res.status(200).json({ success: true });
    } catch (e) {
        next(handleError(e));
    }
});

export default router;
