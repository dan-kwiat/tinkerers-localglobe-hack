'use client';

import { useState, useRef, useEffect } from 'react';

const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID || "agent_01k0cs3j51eqztentn2955bfm2";
const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "sk_58c624946dc2c2717fcc28b1232d732893c91308661f4706";

export default function VoiceChat() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Ready to start conversation');
  const [locationInfo, setLocationInfo] = useState({ protocol: 'unknown', host: 'unknown' });
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Get location info on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLocationInfo({
        protocol: window.location.protocol,
        host: window.location.host
      });
    }
  }, []);

  // Check if browser supports required APIs
  const checkBrowserSupport = () => {
    const issues = [];
    
    if (!navigator.mediaDevices) {
      issues.push('MediaDevices API not supported');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      issues.push('getUserMedia not supported');
    }
    if (!window.MediaRecorder) {
      issues.push('MediaRecorder not supported');
    }
    if (!window.WebSocket) {
      issues.push('WebSocket not supported');
    }
    if (!window.AudioContext && !(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) {
      issues.push('AudioContext not supported');
    }
    
    return issues;
  };

  // Start the voice conversation
  const startConversation = async () => {
    try {
      console.log('=== STARTING CONVERSATION ===');
      console.log('Agent ID:', AGENT_ID);
      console.log('API Key (first 20 chars):', ELEVENLABS_API_KEY.substring(0, 20) + '...');
      
      // Check browser support
      const supportIssues = checkBrowserSupport();
      if (supportIssues.length > 0) {
        console.error('=== BROWSER SUPPORT ISSUES ===');
        console.error('Issues found:', supportIssues);
        console.error('==============================');
        throw new Error(`Browser not supported: ${supportIssues.join(', ')}`);
      }

      // Check if we're on HTTPS
      if (locationInfo.protocol !== 'https:' && locationInfo.host !== 'localhost:3000') {
        console.error('=== HTTPS REQUIRED ===');
        console.error('Current protocol:', locationInfo.protocol);
        console.error('Current hostname:', locationInfo.host);
        console.error('======================');
        throw new Error('HTTPS required for microphone access');
      }

      setStatus('Getting microphone access...');
      
      // Get microphone access with error handling
      let stream: MediaStream;
      try {
        console.log('Requesting microphone access...');
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
        console.log('Microphone access granted');
        console.log('Audio tracks:', stream.getAudioTracks().map(track => ({
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState
        })));
      } catch (micError) {
        console.error('=== MICROPHONE ACCESS ERROR ===');
        console.error('Error type:', micError?.constructor?.name);
        console.error('Error message:', micError instanceof Error ? micError.message : 'Unknown error');
        console.error('Full error object:', micError);
        console.error('==============================');
        throw new Error(`Microphone access denied: ${micError instanceof Error ? micError.message : 'Unknown error'}`);
      }
      
      streamRef.current = stream;
      setStatus('Connecting to ElevenLabs...');

      // Connect directly to ElevenLabs WebSocket with agent_id
      const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        setStatus('Connected! Start speaking...');
        
        // Send initial conversation setup
        console.log('Sending conversation initiation...');
        ws.send(JSON.stringify({
          type: "conversation_initiation_client_data",
          dynamic_variables: {
            date: "friday",
            time: "2pm", 
            nr_of_people: "two"
          }
        }));
        
        // Check MediaRecorder support
        const mimeTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/wav'
        ];
        
        let supportedMimeType = '';
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            supportedMimeType = mimeType;
            console.log('Found supported MIME type:', mimeType);
            break;
          }
        }
        
        if (!supportedMimeType) {
          console.error('=== NO SUPPORTED AUDIO FORMAT ===');
          console.error('Tested MIME types:', mimeTypes);
          console.error('Available types:', mimeTypes.map(type => ({
            type,
            supported: MediaRecorder.isTypeSupported(type)
          })));
          console.error('================================');
          throw new Error('No supported audio format found');
        }
        
        console.log('Using MIME type:', supportedMimeType);
        
        // Set up MediaRecorder for audio capture
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: supportedMimeType
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            console.log('Converting audio chunk to base64:', event.data.size, 'bytes');
            
            // Convert blob to base64 for WebSocket transmission
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1]; // Remove data:audio/... prefix
              console.log('Sending base64 audio chunk:', base64.length, 'chars');
              ws.send(JSON.stringify({
                user_audio_chunk: base64
              }));
            };
            reader.readAsDataURL(event.data);
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error('=== MEDIA RECORDER ERROR ===');
          console.error('Error event:', event);
          console.error('MediaRecorder state:', mediaRecorder.state);
          console.error('===========================');
          setStatus('Recording error - check console');
        };

        // Start recording immediately
        mediaRecorder.start(100); // Send chunks every 100ms
        setIsRecording(true);
        console.log('Recording started');
      };

      ws.onmessage = async (event) => {
        try {
          console.log('=== WEBSOCKET MESSAGE ===');
          console.log('Raw message:', event.data);
          
          // Try to parse as JSON
          let data;
          try {
            data = JSON.parse(event.data);
            console.log('Parsed message type:', data.type);
            console.log('Full parsed data:', data);
          } catch (parseError) {
            console.log('Message is not JSON, checking if it\'s binary audio...');
            if (event.data instanceof Blob) {
              console.log('Received audio blob:', event.data.size, 'bytes');
              await handleAudioResponse(event.data);
            }
            return;
          }

          // Handle different message types
          if (data.type === 'conversation_initiation_metadata') {
            console.log('Conversation initiated:', data.conversation_initiation_metadata_event);
          } else if (data.type === 'user_transcript') {
            console.log('User transcript:', data.user_transcription_event?.user_transcript);
          } else if (data.type === 'agent_response') {
            console.log('Agent response:', data.agent_response_event?.agent_response);
          } else if (data.type === 'audio') {
            console.log('Audio event received');
            if (data.audio_event?.audio_base_64) {
              // Convert base64 to blob and play
              const audioData = atob(data.audio_event.audio_base_64);
              const audioArray = new Uint8Array(audioData.length);
              for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
              }
              const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
              await handleAudioResponse(audioBlob);
            }
          } else if (data.type === 'ping') {
            console.log('Ping received, sending pong...');
            ws.send(JSON.stringify({
              type: 'pong',
              event_id: data.ping_event?.event_id
            }));
          } else {
            console.log('Unhandled message type:', data.type);
          }
          
          console.log('========================');
          
        } catch (error) {
          console.error('=== MESSAGE PROCESSING ERROR ===');
          console.error('Error processing message:', error);
          console.error('Raw message data:', event.data);
          console.error('===============================');
        }
      };

      // Handle audio response function for PCM audio
      const handleAudioResponse = async (audioBlob: Blob) => {
        try {
          setStatus('Playing response...');
          console.log('Playing PCM audio response...');
          
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          }

          const audioContext = audioContextRef.current;
          
          // Resume audio context if suspended (required on mobile)
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
          
          // Convert blob to ArrayBuffer
          const arrayBuffer = await audioBlob.arrayBuffer();
          console.log('Audio data size:', arrayBuffer.byteLength, 'bytes');
          
          // Create audio buffer for PCM 16-bit mono at 16kHz
          const sampleRate = 16000;
          const numberOfChannels = 1;
          const length = arrayBuffer.byteLength / 2; // 16-bit = 2 bytes per sample
          
          console.log('Creating audio buffer:', {
            sampleRate,
            numberOfChannels,
            length,
            durationSeconds: length / sampleRate
          });
          
          const audioBuffer = audioContext.createBuffer(numberOfChannels, length, sampleRate);
          
          // Convert 16-bit PCM data to float32 array
          const pcmData = new Int16Array(arrayBuffer);
          const channelData = audioBuffer.getChannelData(0);
          
          for (let i = 0; i < pcmData.length; i++) {
            // Convert 16-bit signed integer to float32 (-1.0 to 1.0)
            channelData[i] = pcmData[i] / 32768.0;
          }
          
          // Play the audio
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.start(0);
          
          source.onended = () => {
            console.log('Audio playback completed');
            setStatus('Listening...');
          };
          
          console.log('PCM audio playing via Web Audio API');
          
        } catch (error) {
          console.error('=== PCM AUDIO PROCESSING ERROR ===');
          console.error('Error processing PCM audio:', error);
          console.error('Error type:', error?.constructor?.name);
          console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
          console.error('=============================');
          setStatus('PCM audio error - check console');
        }
      };

      ws.onerror = (error) => {
        console.error('=== WEBSOCKET ERROR ===');
        console.error('WebSocket error event:', error);
        console.error('WebSocket URL:', wsUrl);
        console.error('WebSocket readyState:', ws.readyState);
        console.error('======================');
        setStatus('WebSocket error - check console');
      };

      ws.onclose = (event) => {
        console.log('=== WEBSOCKET CLOSED ===');
        console.log('Close code:', event.code);
        console.log('Close reason:', event.reason);
        console.log('Was clean:', event.wasClean);
        console.log('========================');
        
        setIsConnected(false);
        setIsRecording(false);
        setStatus('Connection closed');
        
        if (event.code !== 1000) { // Normal closure
          console.error('=== UNEXPECTED WEBSOCKET CLOSURE ===');
          console.error('Close code:', event.code);
          console.error('Close reason:', event.reason);
          console.error('Was clean:', event.wasClean);
          console.error('===================================');
          setStatus(`Connection closed unexpectedly - check console`);
        }
      };

    } catch (error) {
      console.error('=== CONVERSATION START ERROR ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Full error object:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
      console.error('================================');
      setStatus('Error starting conversation - check console');
    }
  };

  // Stop the conversation
  const stopConversation = () => {
    console.log('=== STOPPING CONVERSATION ===');
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('MediaRecorder stopped');
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      console.log('Media stream tracks stopped');
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User stopped conversation');
      console.log('WebSocket closed by user');
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      console.log('AudioContext closed');
    }

    setIsConnected(false);
    setStatus('Stopped');
    console.log('=============================');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopConversation();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          🎤 Voice Chat
        </h1>
        
        <div className="space-y-6">
          {/* Status Display */}
          <div className="bg-black/20 rounded-lg p-4">
            <p className="text-white/80 text-sm font-medium">Status:</p>
            <p className="text-white text-lg">{status}</p>
          </div>

          {/* Console Notice */}
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-200 text-sm font-medium">📋 Debug Info:</p>
            <p className="text-yellow-100 text-sm">All errors and details are logged to the browser console. Open Developer Tools (F12) to view and copy error messages.</p>
          </div>

          {/* Debug Info */}
          <div className="bg-black/20 rounded-lg p-3">
            <p className="text-white/60 text-xs">
              Protocol: {locationInfo.protocol}<br />
              Host: {locationInfo.host}<br />
              API Key: {ELEVENLABS_API_KEY ? '✓ Set' : '✗ Missing'}<br />
              Agent ID: {AGENT_ID ? '✓ Set' : '✗ Missing'}
            </p>
          </div>

          {/* Connection Indicator */}
          <div className="flex items-center justify-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-white">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Recording Indicator */}
          {isRecording && (
            <div className="flex items-center justify-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white">Recording...</span>
            </div>
          )}

          {/* Control Buttons */}
          <div className="space-y-4">
            {!isConnected ? (
              <button
                onClick={startConversation}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                🎙️ Start Voice Chat
              </button>
            ) : (
              <button
                onClick={stopConversation}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                🛑 Stop Chat
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-black/20 rounded-lg p-4">
            <p className="text-white/80 text-sm">
              💡 <strong>Instructions:</strong><br />
              1. Tap &quot;Start Voice Chat&quot;<br />
              2. Allow microphone access<br />
              3. Start speaking naturally<br />
              4. The AI will respond through your phone speaker
            </p>
          </div>

          {/* Mobile Optimization Notice */}
          <div className="bg-yellow-500/20 rounded-lg p-3">
            <p className="text-yellow-200 text-xs text-center">
              📱 Optimized for mobile browsers via ngrok tunnel
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 