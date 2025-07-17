'use client';

import { useState, useRef, useEffect } from 'react';

const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID || "";
const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "";

export default function VoiceChat() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('incoming');
  const [currentMessage, setCurrentMessage] = useState('');
  const [locationInfo, setLocationInfo] = useState({ protocol: 'unknown', host: 'unknown' });
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

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
  const checkBrowserSupport = (): string[] => {
    const issues: string[] = [];
    
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

  // Convert Float32Array to PCM16 base64
  const float32ToPCM16Base64 = (float32Array: Float32Array): string => {
    const pcm16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Convert float32 (-1.0 to 1.0) to int16 (-32768 to 32767)
      pcm16Array[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32768));
    }
    
    // Convert Int16Array to base64
    const uint8Array = new Uint8Array(pcm16Array.buffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  };

  // Start the voice conversation
  const acceptCall = async () => {
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

      setStatus('connecting');
      
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

      // Connect directly to ElevenLabs WebSocket with agent_id
      const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        setStatus('connected');
        
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
        
        // Set up Web Audio API for real-time PCM audio processing
        try {
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          }

          const audioContext = audioContextRef.current;
          
          // Resume audio context if suspended
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }

          // Create audio source from microphone stream
          const source = audioContext.createMediaStreamSource(stream);
          
          // Create script processor for real-time audio processing
          // Note: ScriptProcessorNode is deprecated but still widely supported
          // We'll use a small buffer size for low latency
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (event) => {
            if (ws.readyState === WebSocket.OPEN) {
              const inputBuffer = event.inputBuffer;
              const inputData = inputBuffer.getChannelData(0);
              
              // Convert float32 audio to PCM16 base64
              const base64Audio = float32ToPCM16Base64(inputData);
              
              console.log('Sending PCM audio chunk:', base64Audio.length, 'chars');
              ws.send(JSON.stringify({
                user_audio_chunk: base64Audio
              }));
            }
          };

          // Connect the audio processing chain
          source.connect(processor);
          processor.connect(audioContext.destination);
          
          setIsRecording(true);
          console.log('Real-time PCM audio processing started');
          
        } catch (audioError) {
          console.error('=== AUDIO CONTEXT ERROR ===');
          console.error('Audio setup error:', audioError);
          console.error('===========================');
          throw new Error('Failed to set up audio processing');
        }
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
            setCurrentMessage(data.user_transcription_event?.user_transcript || '');
          } else if (data.type === 'agent_response') {
            console.log('Agent response:', data.agent_response_event?.agent_response);
            setCurrentMessage(data.agent_response_event?.agent_response || '');
          } else if (data.type === 'audio') {
            console.log('Audio event received');
            if (data.audio_event?.audio_base_64) {
              // Convert base64 to blob and play
              const audioData = atob(data.audio_event.audio_base_64);
              const audioArray = new Uint8Array(audioData.length);
              for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
              }
              const audioBlob = new Blob([audioArray], { type: 'audio/pcm' });
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
          };
          
          console.log('PCM audio playing via Web Audio API');
          
        } catch (error) {
          console.error('=== PCM AUDIO PROCESSING ERROR ===');
          console.error('Error processing PCM audio:', error);
          console.error('Error type:', error?.constructor?.name);
          console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
          console.error('=============================');
        }
      };

      ws.onerror = (error) => {
        console.error('=== WEBSOCKET ERROR ===');
        console.error('WebSocket error event:', error);
        console.error('WebSocket URL:', wsUrl);
        console.error('WebSocket readyState:', ws.readyState);
        console.error('======================');
        setStatus('error');
      };

      ws.onclose = (event) => {
        console.log('=== WEBSOCKET CLOSED ===');
        console.log('Close code:', event.code);
        console.log('Close reason:', event.reason);
        console.log('Was clean:', event.wasClean);
        console.log('========================');
        
        setIsConnected(false);
        setIsRecording(false);
        setStatus('ended');
        
        if (event.code !== 1000) { // Normal closure
          console.error('=== UNEXPECTED WEBSOCKET CLOSURE ===');
          console.error('Close code:', event.code);
          console.error('Close reason:', event.reason);
          console.error('Was clean:', event.wasClean);
          console.error('===================================');
          setStatus('error');
        }
      };

    } catch (error) {
      console.error('=== CONVERSATION START ERROR ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Full error object:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
      console.error('================================');
      setStatus('error');
    }
  };

  // Decline call
  const declineCall = () => {
    setStatus('declined');
  };

  // End call
  const endCall = () => {
    console.log('=== STOPPING CONVERSATION ===');
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
      console.log('Audio processor disconnected');
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
    setIsRecording(false);
    setStatus('ended');
    console.log('=============================');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  const getStatusText = () => {
    switch (status) {
      case 'incoming': return 'Incoming call...';
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'ended': return 'Call ended';
      case 'declined': return 'Call declined';
      case 'error': return 'Call failed';
      default: return 'Incoming call...';
    }
  };

  const getCallDuration = () => {
    if (status === 'connected' && isConnected) {
      return '00:' + (Math.floor(Date.now() / 1000) % 60).toString().padStart(2, '0');
    }
    return '';
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* iPhone-style status bar */}
      <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-6 text-white text-sm font-medium z-10">
        <div className="flex items-center space-x-1">
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-white rounded-full"></div>
            <div className="w-1 h-1 bg-white rounded-full"></div>
            <div className="w-1 h-1 bg-white rounded-full opacity-50"></div>
          </div>
          <span className="ml-2">Verizon</span>
        </div>
        <div className="text-center font-medium">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="flex items-center space-x-1">
          <div className="text-xs">100%</div>
          <div className="w-6 h-3 border border-white rounded-sm">
            <div className="w-full h-full bg-green-500 rounded-sm"></div>
          </div>
        </div>
      </div>

      {/* Background blur effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-black"></div>

      {/* Contact avatar */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-8">
        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center mb-8 shadow-2xl">
          <div className="text-6xl font-light text-white">A</div>
        </div>

        {/* Contact name */}
        <h1 className="text-4xl font-light text-white mb-2">Alexis</h1>
        
        {/* Contact info */}
        <p className="text-xl text-gray-300 mb-1">Restaurant Assistant</p>
        
        {/* Status */}
        <p className="text-lg text-gray-400 mb-4">{getStatusText()}</p>
        
        {/* Call duration */}
        {status === 'connected' && (
          <p className="text-lg text-gray-300 mb-8">{getCallDuration()}</p>
        )}

        {/* Current message */}
        {currentMessage && status === 'connected' && (
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl px-6 py-4 mx-4 mb-8 max-w-sm">
            <p className="text-white text-center text-sm leading-relaxed">
              "{currentMessage}"
            </p>
          </div>
        )}
      </div>

      {/* Call controls */}
      <div className="relative z-10 pb-12">
        {status === 'incoming' && (
          <div className="flex items-center justify-center space-x-20">
            {/* Decline button */}
            <button
              onClick={declineCall}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg transform active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.23 15.26l-2.54-.29a1.99 1.99 0 00-1.64.57l-1.84 1.84a15.045 15.045 0 01-6.59-6.59l1.85-1.85c.43-.43.64-1.03.57-1.64l-.29-2.52a2.001 2.001 0 00-1.99-1.78H5.03c-1.13 0-2.07.94-2 2.07.53 8.54 7.36 15.36 15.89 15.89 1.13.07 2.07-.87 2.07-2v-1.73c.01-1.01-.75-1.86-1.76-1.98z"/>
              </svg>
            </button>

            {/* Accept button */}
            <button
              onClick={acceptCall}
              className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg transform active:scale-95 transition-transform animate-pulse"
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.23 15.26l-2.54-.29a1.99 1.99 0 00-1.64.57l-1.84 1.84a15.045 15.045 0 01-6.59-6.59l1.85-1.85c.43-.43.64-1.03.57-1.64l-.29-2.52a2.001 2.001 0 00-1.99-1.78H5.03c-1.13 0-2.07.94-2 2.07.53 8.54 7.36 15.36 15.89 15.89 1.13.07 2.07-.87 2.07-2v-1.73c.01-1.01-.75-1.86-1.76-1.98z"/>
              </svg>
            </button>
          </div>
        )}

        {(status === 'connected' || status === 'connecting') && (
          <div className="flex items-center justify-center">
            {/* End call button */}
            <button
              onClick={endCall}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg transform active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.23 15.26l-2.54-.29a1.99 1.99 0 00-1.64.57l-1.84 1.84a15.045 15.045 0 01-6.59-6.59l1.85-1.85c.43-.43.64-1.03.57-1.64l-.29-2.52a2.001 2.001 0 00-1.99-1.78H5.03c-1.13 0-2.07.94-2 2.07.53 8.54 7.36 15.36 15.89 15.89 1.13.07 2.07-.87 2.07-2v-1.73c.01-1.01-.75-1.86-1.76-1.98z"/>
              </svg>
            </button>
          </div>
        )}

        {(status === 'ended' || status === 'declined' || status === 'error') && (
          <div className="flex items-center justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-blue-500 text-white rounded-full font-medium transform active:scale-95 transition-transform"
            >
              Call Again
            </button>
          </div>
        )}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-red-500 px-3 py-1 rounded-full">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-white text-xs font-medium">LIVE</span>
        </div>
      )}
    </div>
  );
} 