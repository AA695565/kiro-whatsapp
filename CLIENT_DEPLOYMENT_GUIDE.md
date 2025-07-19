# Deploying the WhatsApp Clone Client to Render

This guide will help you deploy the React client for your WhatsApp clone to Render.com.

## Prerequisites

1. Your backend API is already deployed at `https://kiro-whatsapp-1.onrender.com`
2. You have a [Render account](https://render.com/) (free tier is fine)
3. Your code is pushed to a GitHub repository

## Step 1: Prepare the Client for Deployment

The client is already configured to connect to your deployed backend. The Socket.IO connection in `App.js` is set up to use the correct URL:

```javascript
// Use the appropriate server URL based on environment
const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? 'https://kiro-whatsapp-1.onrender.com'  // Your deployed server URL
  : 'http://localhost:5000';

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

## Step 2: Deploy the Client to Render

### Option 1: Deploy from the Render Dashboard

1. **Login to Render** and go to your dashboard
2. Click on the **"New +"** button and select **"Static Site"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `whatsapp-clone-client`
   - **Build Command**: `cd client && npm install --legacy-peer-deps && npm run build`
   - **Publish Directory**: `client/build`
   - **Environment**: `Node`
   - **Branch**: `main` (or your default branch)
5. Add the following environment variables:
   - `NODE_ENV`: `production`
   - `CI`: `false` (to prevent treating warnings as errors)
6. Add a redirect rule:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Status**: `200`
7. Click **"Create Static Site"**

### Option 2: Deploy using render.yaml

If you prefer to use the Blueprint approach, you can update your `render.yaml` file:

```yaml
services:
  # Backend API service
  - type: web
    name: whatsapp-clone-api
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000

  # Frontend static site
  - type: static
    name: whatsapp-clone-client
    env: static
    buildCommand: cd client && npm install --legacy-peer-deps && npm run build
    staticPublishPath: ./client/build
    envVars:
      - key: NODE_ENV
        value: production
      - key: CI
        value: false
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

Then deploy using the Blueprint option in Render.

## Step 3: Configure CORS on the Backend (if needed)

If you encounter CORS issues after deploying the client, update the CORS configuration in your server.js to include the client URL:

```javascript
// Configure CORS for production
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        "https://whatsapp-clone-client.onrender.com", // Your client URL
        "https://kiro-whatsapp-1.onrender.com"
      ]
    : "http://localhost:3000",
  credentials: true
}));
```

## Step 4: Test the Deployed Application

1. Wait for the deployment to complete (this may take a few minutes)
2. Visit your client URL (e.g., `https://whatsapp-clone-client.onrender.com`)
3. Enter a room code and username to test the chat functionality
4. Open the application in another browser or incognito window to test real-time messaging

## Troubleshooting

### Socket.IO Connection Issues

If you're having trouble with Socket.IO connections:

1. Open the browser console and check for errors
2. Verify that the Socket.IO client is connecting to the correct server URL
3. Check that CORS is properly configured on the server
4. Try using different transports (`websocket`, `polling`)

### Build Failures

If the build fails:

1. Check the build logs in Render dashboard
2. Ensure all dependencies are properly listed in `package.json`
3. Try adding `--legacy-peer-deps` to the npm install command if you have dependency conflicts
4. Set `CI=false` in environment variables to prevent treating warnings as errors

### Render Free Tier Limitations

The free tier of Render has some limitations:

- Static sites remain active, but web services spin down after 15 minutes of inactivity
- When a web service spins down, the first request after inactivity will take longer to respond
- Limited bandwidth and compute resources

## Sharing Your Application

Once deployed, you can share your WhatsApp clone with others by:

1. Sharing the client URL (e.g., `https://whatsapp-clone-client.onrender.com`)
2. Creating a room code for them to join
3. Explaining the 2-participant limit per room

Enjoy your deployed WhatsApp clone! 🚀