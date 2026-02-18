import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('Loading...');
  const [handLandmarker, setHandLandmarker] = useState<any>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    let stream: MediaStream;
    
    const initMediaPipe = async () => {
      try {
        setStatus('Loading MediaPipe...');
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        
        const landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
          },
          runningMode: 'VIDEO',
          numHands: 1
        });
        
        setHandLandmarker(landmarker);
        setStatus('✅ Show your hand!');
      } catch (error) {
        setStatus(`❌ Error: ${error}`);
        console.error(error);
      }
    };

    navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        stream = s;
      }
    }).catch(e => setStatus(`Camera error: ${e}`));

    initMediaPipe();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  useEffect(() => {
    const detectHands = () => {
      if (!videoRef.current || !handLandmarker) {
        animationFrameId.current = requestAnimationFrame(detectHands);
        return;
      }

      if (videoRef.current.readyState === 4) {
        const results = handLandmarker.detectForVideo(videoRef.current, performance.now());
        if (results.landmarks && results.landmarks.length > 0) {
          setStatus(` Hand detected! (${results.landmarks.length} hands)`);
          drawLandmarks(results.landmarks[0], canvasRef.current!, videoRef.current!.videoWidth, videoRef.current!.videoHeight);
        }
      }
      animationFrameId.current = requestAnimationFrame(detectHands);
    };
    
    detectHands();
  }, [handLandmarker]);

  const drawLandmarks = useCallback((landmarks: Float32Array, canvas: HTMLCanvasElement, vidW: number, vidH: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(canvas.width / vidW, canvas.height / vidH);
    
    ctx.fillStyle = '#00ff00';
    for (let i = 0; i < 21; i++) {
      const x = landmarks[i * 3 + 0] * vidW;
      const y = landmarks[i * 3 + 1] * vidH;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: 'black' }}>
      <video
        ref={videoRef}
        style={{ width: '100vw', height: '100vh', objectFit: 'cover' }}
        autoPlay
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none' }}
      />
      <div style={{ 
        position: 'absolute', top: 20, left: 20, color: 'white', 
        fontSize: 24, fontFamily: 'monospace', background: 'rgba(0,0,0,0.7)',
        padding: '10px', borderRadius: '5px' 
      }}>
        {status}
      </div>
    </div>
  );
}

export default App;
