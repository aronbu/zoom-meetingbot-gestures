## Zoom app met handgebaren
## Vereisten
- Python
- Node.js 
  - 18.17.1
- npm
- https://github.com/aronbu/zoom-meetingbot-gestures-AI-api
## Installatie
clone this repo

npm install

npm install -g node-gyp

npm install -g localtunnel

choco install ngrok

ngrok config add-authtoken <token>

in terminal 1

    ngrok http 3001 


## Maak een Zoom app aan
Op marketplace.zoom.us maak je een app aan


Home URL:               https://xxxxx.ngrok-free.app
Redirect URL for OAuth: https://xxxxx.ngrok-free.app/auth

   
OAuth allow list

    https://example.ngrok-free.app

Domain allow list

    appssdk.zoom.us
    ngrok-free.app
    ngrok.io

APIs

    shareApp
    getRunningContext
    getAppContext
    getMeetingJoinUrl

Scopes

    zoomapp:inmeeting

### running your Zoom App
als het nog niet aan het draaien is in terminal 1

    ngrok http 3001 

in terminal 2

    lt --port 8765 

update the env file with the new urls

in terminal 3

    npm run dev


