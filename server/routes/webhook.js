import express from 'express';
import crypto from 'crypto';

import { handleError, sanitize } from '../helpers/routing.js';
import { zoomApp } from '../config.js';
import db from '../helpers/database.js';

const router = express.Router();
const WebSocket = require('ws');
import * as tf from '@tensorflow/tfjs';
require('@tensorflow/tfjs-node-gpu');
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import sharp from 'sharp';

/**
 * 1. Initialize the Hand Pose Detector (Mediapipe backend).
 *    We use the "MediaPipeHands" solution under the hood.
 */
const model = handPoseDetection.SupportedModels.MediaPipeHands;
const detectorConfig = {
    runtime: 'tfjs', // or 'mediapipe'
    modelType: 'lite', // 'full' or 'lite' or 'heavy'
    // For the MediaPipe mode:
    solutionPath: 'node_modules/@mediapipe/hands', // Where the MP files exist
};

let detector;
(async () => {
    await initHandpose();
})();

/**
 * Initialize the detector once at startup
 */
async function initHandpose() {
    detector = await handPoseDetection.createDetector(model, detectorConfig);
    console.log('Hand pose detector initialized!');
}

/**
 * 2. Run detection on an image (PNG/JPG Buffer)
 */
async function detectHandGesture(imageBuffer) {
    if (!detector) {
        throw new Error('Detector not initialized yet.');
    }

    // Convert the buffer to a Tensor in Node
    //  - We'll use "sharp" to decode the buffer and get raw RGBA data
    //  - Then convert to a tf.Tensor suitable for the model

    // 2A. Decode with sharp
    const rawImage = await sharp(imageBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { width, height } = rawImage.info;
    const rgbaTensor = tf.tensor3d(rawImage.data, [height, width, 4], 'int32');

    // 2B. Convert RGBA -> RGB by discarding alpha
    const rgbTensor = rgbaTensor.slice([0, 0, 0], [-1, -1, 3]).cast('int32');

    // 2C. Run detection
    const hands = await detector.estimateHands(rgbTensor);

    rgbaTensor.dispose();
    rgbTensor.dispose();

    if (!hands.length) {
        return 'no_hand_detected';
    }

    // For simplicity, assume only 1 hand
    const handLandmarks = hands[0].keypoints3D || hands[0].keypoints;
    if (!handLandmarks) {
        return 'no_hand_detected';
    }

    // 3. Decide if thumbs up or thumbs down
    const thumbTip = handLandmarks[4];
    const indexMcp = handLandmarks[5];

    if (!thumbTip || !indexMcp) {
        return 'hand_detected_but_landmarks_incomplete';
    }

    const diffY = thumbTip.y - indexMcp.y;
    if (diffY < 0) {
        return 'thumbs_up';
    } else {
        return 'thumbs_down';
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
                const gesture = await detectHandGesture(imageData);
                console.log(
                    `Detected gesture: ${gesture} at ${timestamp} for stream ${streamId}`
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
