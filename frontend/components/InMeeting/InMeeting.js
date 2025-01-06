import React, { useEffect, useState } from 'react';
import './InMeeting.css';

import zoomSdk from '@zoom/appssdk';
import appFetch from '../../helpers/fetch';

function InMeeting() {
    const [recordingState, setRecordingState] = useState('stopped');
    const [gestureData, setGestureData] = useState({
        thumbsUp: 0,
        thumbsDown: 0,
    });
    const [isGestureDetectionActive, setIsGestureDetectionActive] =
        useState(false);

    const toggleRecording = async () => {
        if (recordingState === 'stopped') {
            await startRecording();
        } else {
            await stopRecording();
        }
    };

    const startRecording = async () => {
        setRecordingState('starting');

        const meetingUrl = await zoomSdk.getMeetingJoinUrl();
        const res = await appFetch('/api/start-recording', {
            method: 'POST',
            body: JSON.stringify({
                meetingUrl: meetingUrl.joinUrl,
            }),
        });

        if (res.status <= 299) {
            setRecordingState('bot-joining');
        } else {
            setRecordingState('error');
        }
    };

    const stopRecording = async () => {
        setRecordingState('stopping');
        const res = await appFetch('/api/stop-recording', { method: 'POST' });

        if (res.status <= 299) {
            setRecordingState('bot-leaving');
        } else {
            setRecordingState('error');
        }
    };

    const refreshState = async () => {
        if (recordingState === 'starting' || recordingState === 'stopping') {
            return;
        }

        const res = await appFetch('/api/recording-state', {
            method: 'GET',
        });

        if (res.status === 400) {
            setRecordingState('stopped');
            return;
        }

        const { state } = await res.json();

        if (state === 'in_call_not_recording') {
            setRecordingState('waiting');
        } else if (
            state === 'in_call_recording' &&
            recordingState !== 'bot-leaving'
        ) {
            setRecordingState('recording');
        } else if (state === 'call_ended') {
            setRecordingState('bot-leaving');
        } else if (state === 'fatal') {
            setRecordingState('error');
        } else if (state === 'done') {
            setRecordingState('stopped');
        }
    };

    const handleStartStopGestureDetection = async () => {
        try {
            console.log('Toggling gesture detection');
            const res = await appFetch('/webhook/toggle-gesture-detection', {
                method: 'POST',
            });
            const data = await res.json();
            setGestureData(data);
            setIsGestureDetectionActive(!isGestureDetectionActive);
        } catch (error) {
            console.error('Error toggling gesture detection:', error);
        }
    };

    useEffect(() => {
        refreshState();
    }, []);

    useEffect(() => {
        const interval = setInterval(refreshState, 2000);
        return () => clearInterval(interval);
    }, [recordingState]);

    return (
        <div className="InMeeting">
            <header>
                <h1>Gesture detection app</h1>
            </header>
            <div className="InMeeting-record">
                <button
                    onClick={toggleRecording}
                    disabled={
                        [
                            'starting',
                            'bot-joining',
                            'waiting',
                            'stopping',
                            'bot-leaving',
                            'error',
                        ].includes(recordingState) || isGestureDetectionActive
                    }
                >
                    {recordingState === 'stopped' && 'Let the meeting bot join'}
                    {recordingState === 'recording' && 'Stop the meeting bot'}
                    {recordingState === 'starting' && 'Starting...'}
                    {recordingState === 'stopping' && 'Stopping...'}
                    {recordingState === 'waiting' &&
                        'Waiting for permission...'}
                    {recordingState === 'error' && 'An error occurred'}
                    {recordingState === 'bot-joining' && 'Starting...'}
                    {recordingState === 'bot-leaving' && 'Stopping...'}
                </button>

                <button
                    onClick={handleStartStopGestureDetection}
                    disabled={recordingState !== 'recording'}
                >
                    {isGestureDetectionActive
                        ? 'Stop Gesture Detection'
                        : 'Start Gesture Detection'}
                </button>
                <div>
                    <p>Thumbs Up: {gestureData.thumbsUp}</p>
                    <p>Thumbs Down: {gestureData.thumbsDown}</p>
                </div>
            </div>
        </div>
    );
}

export default InMeeting;
