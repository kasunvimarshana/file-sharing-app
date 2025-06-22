import React, { useRef, useEffect } from 'react';
import { Maximize2, Minimize2, MousePointer } from 'lucide-react';

interface ScreenViewerProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isSharing: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
}

export const ScreenViewer: React.FC<ScreenViewerProps> = ({
  localStream,
  remoteStream,
  isSharing,
  localVideoRef,
  remoteVideoRef,
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, localVideoRef]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteVideoRef]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div ref={containerRef} className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-gray-700 border-b border-gray-600">
        <h3 className="text-lg font-medium text-white">
          {isSharing ? 'Your Screen' : 'Remote Screen'}
        </h3>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 px-2 py-1 bg-gray-600 rounded-md text-xs text-gray-300">
            <MousePointer className="w-3 h-3" />
            <span>Click to control</span>
          </div>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-600 text-gray-300 hover:text-white rounded transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="relative aspect-video bg-black">
        {isSharing && localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            className="w-full h-full object-contain"
          />
        ) : remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            className="w-full h-full object-contain cursor-pointer"
            onClick={(e) => {
              // In a real application, this would send mouse coordinates
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              console.log(`Mouse click at: ${x.toFixed(2)}%, ${y.toFixed(2)}%`);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <MousePointer className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">
                {isSharing ? 'Starting screen share...' : 'Waiting for remote connection...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Connection Quality Indicator */}
      <div className="p-2 bg-gray-700 border-t border-gray-600">
        <div className="flex items-center justify-between text-sm text-gray-300">
          <span>Quality: HD (1920x1080)</span>
          <span>Latency: 42ms</span>
          <span>FPS: 30</span>
        </div>
      </div>
    </div>
  );
};