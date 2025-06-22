import { useState, useRef, useCallback } from 'react';
import { ConnectionState } from '../types';

export const useWebRTC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    sessionId: '',
    remoteSessionId: '',
    localStream: null,
    remoteStream: null,
  });

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const generateSessionId = useCallback(() => {
    return Math.random().toString(36).substring(2, 11).toUpperCase();
  }, []);

  const initializePeerConnection = useCallback(() => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    peerConnection.current = new RTCPeerConnection(config);

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        // In a real application, you would send this to the remote peer
        console.log('ICE Candidate:', event.candidate);
      }
    };

    peerConnection.current.ontrack = (event) => {
      setConnectionState(prev => ({
        ...prev,
        remoteStream: event.streams[0],
      }));
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnection.current.onconnectionstatechange = () => {
      const state = peerConnection.current?.connectionState;
      if (state === 'connected') {
        setConnectionState(prev => ({ ...prev, status: 'connected' }));
      } else if (state === 'failed' || state === 'disconnected') {
        setConnectionState(prev => ({ ...prev, status: 'error' }));
      }
    };

    // Create data channel for file transfer and chat
    dataChannel.current = peerConnection.current.createDataChannel('data', {
      ordered: true,
    });

    dataChannel.current.onopen = () => {
      console.log('Data channel opened');
    };

    dataChannel.current.onmessage = (event) => {
      console.log('Data channel message:', event.data);
      // Handle incoming messages/files
    };

    peerConnection.current.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (event) => {
        console.log('Received data:', event.data);
      };
    };
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      setConnectionState(prev => ({ ...prev, status: 'connecting' }));
      
      const sessionId = generateSessionId();
      setConnectionState(prev => ({ ...prev, sessionId }));

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' },
        audio: true,
      });

      setConnectionState(prev => ({ ...prev, localStream: stream }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      initializePeerConnection();

      if (peerConnection.current) {
        stream.getTracks().forEach(track => {
          peerConnection.current?.addTrack(track, stream);
        });

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        
        // In a real application, you would send this offer to the remote peer
        console.log('Created offer:', offer);
      }

      setConnectionState(prev => ({ ...prev, status: 'connected' }));
    } catch (error) {
      console.error('Error starting screen share:', error);
      setConnectionState(prev => ({ ...prev, status: 'error' }));
    }
  }, [generateSessionId, initializePeerConnection]);

  const connectToRemote = useCallback(async (remoteSessionId: string) => {
    try {
      setConnectionState(prev => ({ 
        ...prev, 
        status: 'connecting',
        remoteSessionId 
      }));

      initializePeerConnection();

      // In a real application, you would:
      // 1. Signal to the remote peer with the session ID
      // 2. Exchange ICE candidates
      // 3. Handle the offer/answer exchange
      
      // Simulate connection process
      setTimeout(() => {
        setConnectionState(prev => ({ ...prev, status: 'connected' }));
      }, 2000);

    } catch (error) {
      console.error('Error connecting to remote:', error);
      setConnectionState(prev => ({ ...prev, status: 'error' }));
    }
  }, [initializePeerConnection]);

  const disconnect = useCallback(() => {
    if (connectionState.localStream) {
      connectionState.localStream.getTracks().forEach(track => track.stop());
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }

    setConnectionState({
      status: 'disconnected',
      sessionId: '',
      remoteSessionId: '',
      localStream: null,
      remoteStream: null,
    });
  }, [connectionState.localStream]);

  const sendData = useCallback((data: string) => {
    if (dataChannel.current && dataChannel.current.readyState === 'open') {
      dataChannel.current.send(data);
    }
  }, []);

  return {
    connectionState,
    localVideoRef,
    remoteVideoRef,
    startScreenShare,
    connectToRemote,
    disconnect,
    sendData,
  };
};