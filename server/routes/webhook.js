import express from 'express';
import crypto from 'crypto';

import { handleError, sanitize } from '../helpers/routing.js';
import { zoomApp } from '../config.js';
import db from '../helpers/database.js';

const router = express.Router();
const WebSocket = require('ws');
import axios from 'axios';

async function detectHandGesture(imageBuffer) {
    try {
        const formData = new FormData();
        formData.append(
            'image',
            new Blob([imageBuffer], { type: 'image/png' }),
            'image.png'
        );

        const response = await axios.post(
            'http://192.168.8.129:5000/detect_gesture',
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );

        if (response.data.error) {
            return { error: response.data.error };
        }

        const { hand_sign, finger_gesture } = response.data;
        return { hand_sign, finger_gesture };
    } catch (error) {
        console.error('Error detecting hand gesture:', error);
        throw error;
    }
}

/**
 * 3. WebSocket Server
 */
const wss = new WebSocket.Server({ port: 8765 });

/**
 * Throttling variables:
 *  - frameCount: increments on each message
 *  - lastProcessedTime: tracks the last time we did AI detection + wrote a file
 */

wss.on('connection', (ws) => {
    console.log('New WebSocket connection established.');

    ws.on('message', async (message) => {
        // If message is text, just log it out
        if (typeof message === 'string') {
            console.log('Received text message:', message);
            return;
        }

        // Otherwise, treat it as binary data
        try {
            // The first 8 bytes might be some metadata in your example
            const streamId = message.readUInt32LE(0);
            const timestamp = message.readUInt32LE(4);

            // Actual image data is after the first 8 bytes
            const imageData = message.slice(8);

            // Perform AI inference on imageData
            if (timestamp % 1500 === 0) {
                console.log(`Detecting gesture: at ${timestamp}`);
                const gestureData = await detectHandGesture(imageData);

                console.log('Finger Gesture:', gestureData.finger_gesture);
                console.log(
                    `Detected gesture: ${gestureData.hand_sign} ${gestureData.finger_gesture} at ${timestamp} for stream ${streamId}`
                );
            }
        } catch (err) {
            console.error('Error handling image message:', err);
        }
    });
});

console.log('WebSocket server is running on ws://0.0.0.0:8765');

/**
 * 4. REST Endpoint for Zoom transcription
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
