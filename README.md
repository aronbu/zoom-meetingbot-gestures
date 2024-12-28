## Zoom app with ai gesture detection
### Requirements
- Python
- Node.js 
  - 18.17.1
- npm
- NVIDIA® GPU drivers 
  - 450.x or higher
- Cuda toolkit 
  - 11.2
- cuDNN
  - 8.1.0
### Installation
clone this repo

npm install

npm install -g node-gyp

npm install -g localtunnel

choco install ngrok

ngrok config add-authtoken <token>

in terminal 1

    ngrok http 3001 

in terminal 2

    lt --port 8765 

in terminal 3

    npm run dev


