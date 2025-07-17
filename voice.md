# 🎤 Voice Chat Setup for Hackathon

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
Create a `.env.local` file in the root directory:
```
NEXT_PUBLIC_ELEVENLABS_API_KEY=sk_58c624946dc2c2717fcc28b1232d732893c91308661f4706
NEXT_PUBLIC_AGENT_ID=agent_01k0cs3j51eqztentn2955bfm2
```

### 3. Start the development server
```bash
npm run dev
```

### 4. Set up ngrok tunnel (for mobile access)
```bash
# Install ngrok if you haven't already
# Then run:
ngrok http 3000
```

### 5. Access from your phone
1. Copy the HTTPS ngrok URL (e.g., `https://abc123.ngrok.io`)
2. Open this URL in your phone's browser
3. Tap "Start Voice Chat"
4. Allow microphone permissions
5. Start talking!

## How it works

- 🎙️ **Captures audio** from your phone's microphone using Web Audio API
- 🔄 **Streams audio** to ElevenLabs ConvAI via WebSocket
- 🎵 **Plays responses** through your phone's speaker
- 📱 **Mobile optimized** interface with touch-friendly controls

## Key Features

- ✅ Real-time voice conversation
- ✅ Mobile browser compatible
- ✅ HTTPS required (ngrok provides this)
- ✅ Automatic audio echo cancellation
- ✅ Noise suppression
- ✅ Visual status indicators

## Troubleshooting

### Microphone not working
- Make sure you're using HTTPS (ngrok URL)
- Check browser permissions
- Try refreshing the page

### Audio playback issues
- Check phone volume
- Try using headphones
- Refresh the page if audio stops working

### Connection issues
- Verify your ElevenLabs API key is valid
- Check console for error messages
- Make sure you have internet connection

## Mobile Browser Tips

- **iOS Safari**: Works best, full Web Audio API support
- **Chrome Mobile**: Also works well
- **Firefox Mobile**: May have some audio quirks
- Use headphones for best audio quality and to prevent feedback

## API Usage

The app automatically:
1. Creates a new conversation with your ElevenLabs agent
2. Establishes WebSocket connection
3. Streams audio chunks (100ms intervals)
4. Plays received audio responses
5. Handles cleanup when stopped

Perfect for hackathon demos! 🚀 