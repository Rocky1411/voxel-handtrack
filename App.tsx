import { VoxelStore } from "./Store/voxelstore";
import VoxelVisualization from './Components/VoxelVisualization';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('Loading...');
  const [handLandmarker, setHandLandmarker] = useState<any>(null);
  const [voxels, setVoxels] = useState<any[]>([]);
  const animationFrameId = useRef<number | null>(null);

  const voxelStore = new VoxelStore();
const gridSize = 40;
const lastVoxelTime = useRef<number>(0);
const voxelThreshold = 500; // milliseconds between voxel additions
const currentGesture = useRef<string>('none');
const lastGestureTime = useRef<number>(0);
const gestureThreshold = 1000; // milliseconds between gesture actions

  const detectGesture = useCallback((landmarks: Float32Array): string => {
    // Key landmark indices for hand tracking
    const THUMB_TIP = 4;
    const INDEX_FINGER_TIP = 8;
    const MIDDLE_FINGER_TIP = 12;
    const RING_FINGER_TIP = 16;
    const PINKY_TIP = 20;
    
    const THUMB_IP = 3;
    const INDEX_FINGER_PIP = 6;
    const MIDDLE_FINGER_PIP = 10;
    const RING_FINGER_PIP = 14;
    const PINKY_PIP = 18;
    
    const WRIST = 0;
    
    // Calculate distances
    const getDistance = (idx1: number, idx2: number) => {
      const dx = landmarks[idx1 * 3 + 0] - landmarks[idx2 * 3 + 0];
      const dy = landmarks[idx1 * 3 + 1] - landmarks[idx2 * 3 + 1];
      const dz = landmarks[idx1 * 3 + 2] - landmarks[idx2 * 3 + 2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    
    // Check if fingers are extended
    const thumbExtended = getDistance(THUMB_TIP, THUMB_IP) > getDistance(THUMB_IP, WRIST) * 0.7;
    const indexExtended = getDistance(INDEX_FINGER_TIP, INDEX_FINGER_PIP) > getDistance(INDEX_FINGER_PIP, WRIST) * 0.5;
    const middleExtended = getDistance(MIDDLE_FINGER_TIP, MIDDLE_FINGER_PIP) > getDistance(MIDDLE_FINGER_PIP, WRIST) * 0.5;
    const ringExtended = getDistance(RING_FINGER_TIP, RING_FINGER_PIP) > getDistance(RING_FINGER_PIP, WRIST) * 0.5;
    const pinkyExtended = getDistance(PINKY_TIP, PINKY_PIP) > getDistance(PINKY_PIP, WRIST) * 0.5;
    
    const extendedCount = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;
    
    // Gesture recognition logic
    if (extendedCount === 0) {
      return 'fist'; // Closed fist
    } else if (extendedCount === 1 && indexExtended) {
      return 'point'; // Pointing with index finger
    } else if (extendedCount >= 4) {
      return 'open'; // Open palm
    } else if (thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'thumbs_up'; // Thumbs up
    } else {
      return 'partial'; // Partial hand opening
    }
  }, []);

  const handLandmarkerToVoxel = useCallback((landmarks: Float32Array, vidW: number, vidH: number) => {
    // Use index finger tip (landmark 8) for voxel placement
    const indexTipX = landmarks[8 * 3 + 0] * vidW;
    const indexTipY = landmarks[8 * 3 + 1] * vidH;
    const indexTipZ = landmarks[8 * 3 + 2] || 0;
    
    // Convert to voxel grid coordinates
    const voxelX = Math.floor((indexTipX / vidW) * gridSize);
    const voxelY = Math.floor((indexTipY / vidH) * gridSize);
    const voxelZ = Math.floor((indexTipZ + 1) * gridSize / 2); // Normalize Z to 0-1 range
    
    return { x: voxelX, y: voxelY, z: voxelZ };
  }, []);

  const addVoxelFromHand = useCallback((landmarks: Float32Array, vidW: number, vidH: number) => {
    const gesture = detectGesture(landmarks);
    const currentTime = Date.now();
    
    // Only process gesture actions if enough time has passed
    if (currentTime - lastGestureTime.current < gestureThreshold && gesture !== currentGesture.current) {
      return;
    }
    
    currentGesture.current = gesture;
    
    const voxel = handLandmarkerToVoxel(landmarks, vidW, vidH);
    
    switch (gesture) {
      case 'point':
        // Add voxel with position-based color
        if (currentTime - lastVoxelTime.current >= voxelThreshold) {
          const hue = (voxel.x / gridSize) * 360;
          const color = `hsl(${hue}, 70%, 50%)`;
          voxelStore.addVoxel(voxel.x, voxel.y, voxel.z, color);
          lastVoxelTime.current = currentTime;
          setStatus(`Gesture: ${gesture} - Voxel added at (${voxel.x}, ${voxel.y}, ${voxel.z})`);
        }
        break;
        
      case 'fist':
        // Clear all voxels
        if (currentTime - lastGestureTime.current >= gestureThreshold) {
          voxelStore.clearAll();
          lastGestureTime.current = currentTime;
          setStatus(`Gesture: ${gesture} - Cleared all voxels!`);
        }
        break;
        
      case 'open':
        // Change colors of existing voxels
        if (currentTime - lastGestureTime.current >= gestureThreshold) {
          const existingVoxels = voxelStore.getVoxels();
          existingVoxels.forEach(v => {
            const newHue = Math.random() * 360;
            v.color = `hsl(${newHue}, 70%, 50%)`;
          });
          lastGestureTime.current = currentTime;
          setStatus(`Gesture: ${gesture} - Randomized voxel colors!`);
        }
        break;
        
      case 'thumbs_up':
        // Add random burst of voxels
        if (currentTime - lastGestureTime.current >= gestureThreshold) {
          for (let i = 0; i < 10; i++) {
            const randomX = Math.floor(Math.random() * gridSize);
            const randomY = Math.floor(Math.random() * gridSize);
            const randomZ = Math.floor(Math.random() * gridSize);
            const randomHue = Math.random() * 360;
            const color = `hsl(${randomHue}, 70%, 50%)`;
            voxelStore.addVoxel(randomX, randomY, randomZ, color);
          }
          lastGestureTime.current = currentTime;
          setStatus(`Gesture: ${gesture} - Added voxel burst!`);
        }
        break;
        
      default:
        setStatus(`Gesture: ${gesture} - Try pointing, open palm, fist, or thumbs up`);
    }
    
    // Update voxel state for visualization
    setVoxels([...voxelStore.getVoxels()]);
  }, [detectGesture, handLandmarkerToVoxel]);

  const drawLandmarks = useCallback((landmarks: Float32Array, canvas: HTMLCanvasElement, vidW: number, vidH: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const gesture = currentGesture.current;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(canvas.width / vidW, canvas.height / vidH);
    
    // Color based on gesture
    let color = '#00ff00'; // Default green
    switch (gesture) {
      case 'point': color = '#ffff00'; break; // Yellow for pointing
      case 'open': color = '#00ffff'; break; // Cyan for open
      case 'fist': color = '#ff0000'; break; // Red for fist
      case 'thumbs_up': color = '#ff00ff'; break; // Magenta for thumbs up
      default: color = '#ffffff'; break; // White for partial/unknown
    }
    
    ctx.fillStyle = color;
    for (let i = 0; i < 21; i++) {
      const x = landmarks[i * 3 + 0] * vidW;
      const y = landmarks[i * 3 + 1] * vidH;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw gesture name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial';
    ctx.fillText(gesture.toUpperCase(), 50, 50);
    
    ctx.restore();
  }, []);

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
          addVoxelFromHand(results.landmarks[0], videoRef.current!.videoWidth, videoRef.current!.videoHeight);
          drawLandmarks(results.landmarks[0], canvasRef.current!, videoRef.current!.videoWidth, videoRef.current!.videoHeight);
        }
      }
      animationFrameId.current = requestAnimationFrame(detectHands);
    };
    
    detectHands();
  }, [handLandmarker, addVoxelFromHand]);

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
      <VoxelVisualization voxels={voxels} gridSize={gridSize} />
      
      {/* Status Panel */}
      <div style={{ 
        position: 'absolute', top: 20, left: 20, color: 'white', 
        fontSize: 18, fontFamily: 'Arial, sans-serif', background: 'rgba(0,0,0,0.8)',
        padding: '15px', borderRadius: '10px', minWidth: '300px',
        border: '1px solid #333', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}>
        <div style={{ marginBottom: '10px', fontSize: 20, fontWeight: 'bold' }}>
          🎯 Voxel Hand Tracker
        </div>
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: '#00ff00' }}>Status:</span> {status}
        </div>
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: '#ffff00' }}>Voxels:</span> {voxels.length}
        </div>
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: '#00ffff' }}>Gesture:</span> {currentGesture.current?.toUpperCase() || 'NONE'}
        </div>
      </div>

      {/* Instructions Panel */}
      <div style={{ 
        position: 'absolute', bottom: 20, left: 20, color: 'white', 
        fontSize: 14, fontFamily: 'Arial, sans-serif', background: 'rgba(0,0,0,0.8)',
        padding: '15px', borderRadius: '10px', maxWidth: '350px',
        border: '1px solid #333', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}>
        <div style={{ marginBottom: '10px', fontSize: 16, fontWeight: 'bold' }}>
          📋 Gesture Controls
        </div>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: '#ffff00' }}>☝️ Point:</span> Add single voxel
        </div>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: '#ff0000' }}>✊ Fist:</span> Clear all voxels
        </div>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: '#00ffff' }}>✋ Open:</span> Randomize colors
        </div>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: '#ff00ff' }}>👍 Thumbs Up:</span> Voxel burst (10x)
        </div>
      </div>

      {/* 3D View Label */}
      <div style={{ 
        position: 'absolute', top: 20, right: 20, color: 'white', 
        fontSize: 14, fontFamily: 'Arial, sans-serif', background: 'rgba(0,0,0,0.8)',
        padding: '8px 12px', borderRadius: '8px',
        border: '1px solid #333', marginRight: 'calc(30vw + 10px)'
      }}>
        🎮 3D Voxel View
      </div>
    </div>
  );
}

export default App;

