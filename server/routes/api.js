import express from 'express';
import { handleError, sanitize } from '../helpers/routing.js';
import { contextHeader, getAppContext } from '../helpers/cipher.js';
import { recallFetch } from '../helpers/recall.js';

import session from '../session.js';
import { zoomApp } from '../config.js';

const router = express.Router();

/*
 * Gets the context of the Zoom App
 */
router.get('/context', async (req, res, next) => {
    try {
        sanitize(req);

        const header = req.header(contextHeader);

        const isZoom = !!(header && getAppContext(header));

        return res.json({
            isZoom,
        });
    } catch (e) {
        next(handleError(e));
    }
});

const validateAppContext = (req) => {
    const header = req.header(contextHeader);

    if (!header || !getAppContext(header)) {
        const e = new Error('Unauthorized');
        e.code = 401;
        throw e;
    }
};

/*
 * Send's a Recall Bot to start recording the call
 */
router.post('/start-recording', session, async (req, res, next) => {
    try {
        sanitize(req);
        validateAppContext(req);

        if (!req.body.meetingUrl) {
            return res.status(400).json({ error: 'Missing meetingUrl' });
        }

        console.log('recall bot start recording', req.body.meetingUrl);

        // @see https://recallai.readme.io/reference/bot_create
        const bot = await recallFetch('/api/v1/bot', {
            method: 'POST',
            body: JSON.stringify({
                bot_name: `${process.env.BOT_NAME}`,
                meeting_url: req.body.meetingUrl,
                recording_mode: 'gallery_view',
                zoom: {
                    request_recording_permission_on_host_join: true,
                    require_recording_permission: true,
                },
                real_time_media: {
                    websocket_video_destination_url: `wss://${zoomApp.webhookUrl}`,
                },
            }),
        });

        console.log('recall bot', bot);
        req.session.botId = bot.id;

        return res.json({
            botId: bot.id,
        });
    } catch (e) {
        next(handleError(e));
    }
});

/*
 * Tells the Recall Bot to stop recording the call
 */
router.post('/stop-recording', session, async (req, res, next) => {
    try {
        sanitize(req);
        validateAppContext(req);

        if (!req.session.botId) {
            return res.status(400).json({ error: 'Missing botId' });
        }

        await recallFetch(`/api/v1/bot/${req.session.botId}/leave_call`, {
            method: 'POST',
        });

        console.log('recall bot stopped');
        return res.json({});
    } catch (e) {
        next(handleError(e));
    }
});

/*
 * Gets the current state of the Recall Bot
 */
router.get('/recording-state', session, async (req, res, next) => {
    try {
        sanitize(req);
        validateAppContext(req);

        const botId = req.session.botId;

        if (!botId) {
            return res.status(400).json({ error: 'Missing botId' });
        }

        const bot = await recallFetch(`/api/v1/bot/${botId}`, {
            method: 'GET',
        });
        const latestStatus = bot.status_changes.slice(-1)[0].code;

        return res.json({
            state: latestStatus,
        });
    } catch (e) {
        next(handleError(e));
    }
});

export default router;
