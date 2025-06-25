import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    onSnapshot, 
    collection, 
    addDoc, 
    query,
    orderBy,
    limit,
    serverTimestamp,
    deleteDoc
} from 'firebase/firestore';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Copy, Languages, MessageSquare, AlertCircle, LogIn, PlusCircle, UserCircle } from 'lucide-react';

// --- IMPORTANT: Firebase Configuration ---
// This code now ONLY uses environment variables for deployment.
const firebaseConfig = process.env.REACT_APP_FIREBASE_CONFIG 
    ? JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG) 
    : {};

const appId = process.env.REACT_APP_ID || 'default-translate-app';

// --- Language Options ---
const LANGUAGES = {
    'en-US': 'English (US)', 'es-ES': 'Spanish', 'fr-FR': 'French', 'de-DE': 'German',
    'it-IT': 'Italian', 'ja-JP': 'Japanese', 'ko-KR': 'Korean', 'pt-BR': 'Portuguese (Brazil)',
    'ru-RU': 'Russian', 'zh-CN': 'Chinese (Mandarin)',
};

// --- STUN Servers Configuration ---
const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    ],
    iceCandidatePoolSize: 10,
};

// --- Helper & UI Components ---

const LanguageSelector = ({ value, onChange, disabled }) => (
    <div className="relative w-full">
        <Languages className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
            {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
    </div>
);

const IconButton = ({ onClick, children, className = '', disabled = false, text }) => (
    <button onClick={onClick} disabled={disabled}
        className={`flex flex-col items-center justify-center p-3 rounded-lg w-20 h-20 transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${className}`}>
        {children}
        {text && <span className="text-xs mt-1">{text}</span>}
    </button>
);

const CaptionBubble = ({ caption, localUserId }) => {
    const isLocal = caption.senderId === localUserId;
    return (
        <div className={`flex my-2 ${isLocal ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-md p-3 rounded-lg shadow-md ${isLocal ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-600 text-white rounded-bl-none'}`}>
                <p className="text-sm opacity-80">{caption.original}</p>
                <p className="text-lg font-semibold">{caption.translated}</p>
            </div>
        </div>
    );
};

const VideoPlayer = ({ stream, isMuted, placeholderText }) => (
    <div className="w-full h-full bg-black rounded-lg flex items-center justify-center relative overflow-hidden">
        {stream ? (
            <video srcObject={stream} autoPlay playsInline muted={isMuted} className="w-full h-full object-cover" />
        ) : (
            <div className="text-center text-gray-400">
                <UserCircle size={64} className="mx-auto opacity-50" />
                <p className="mt-2">{placeholderText}</p>
            </div>
        )}
    </div>
);

const HomeScreen = ({ onJoin, onCreate, userId }) => {
    const [joinCallId, setJoinCallId] = useState('');
    const [homeStatus, setHomeStatus] = useState('');
    const [targetLanguage, setTargetLanguage] = useState('es-ES');
    const statusTimeoutRef = useRef(null);

    const handleJoin = () => {
        if (!joinCallId) {
            setHomeStatus("Please enter a Call ID.");
            if(statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
            statusTimeoutRef.current = setTimeout(() => setHomeStatus(''), 3000);
            return;
        }
        onJoin(joinCallId, targetLanguage);
    };
    
    const handleCreate = () => {
        onCreate(targetLanguage);
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md text-center">
                <h1 className="text-5xl font-bold text-blue-400">TranslateCall</h1>
                <p className="text-gray-400 mt-2 mb-8">Real-time translated conversations.</p>
            </div>
            <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl space-y-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-center">Select Your Target Language</h2>
                    <LanguageSelector value={targetLanguage} onChange={setTargetLanguage} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={handleCreate} className="group flex items-center justify-center gap-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition transform hover:scale-105">
                        <PlusCircle className="group-hover:rotate-90 transition-transform"/> Create New Call
                    </button>
                    <button onClick={handleJoin} disabled={!joinCallId} className="group flex items-center justify-center gap-3 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-500 disabled:cursor-not-allowed">
                        <LogIn /> Join Call
                    </button>
                </div>
                <div className="space-y-2">
                     <input type="text" value={joinCallId} onChange={(e) => setJoinCallId(e.target.value)} placeholder="Enter Call ID to Join"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
                     <div className="h-5 text-center text-red-400 text-sm">{homeStatus}</div>
                </div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-8">Your User ID (for debugging): {userId}</p>
        </div>
    );
};

// --- Main App Component ---

export default function App() {
    // --- State Variables ---
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);

    const [mode, setMode] = useState('home'); // 'home', 'in-call'
    const [callId, setCallId] = useState('');
    
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    
    const [captions, setCaptions] = useState([]);
    const [isRecognizing, setIsRecognizing] = useState(false);
    const [targetLanguage, setTargetLanguage] = useState('es-ES');
    const [status, setStatus] = useState({ text: 'Ready', type: 'idle' }); // {text, type: 'idle'|'connecting'|'connected'|'error'|'disconnected'}
    
    // --- Refs ---
    const pc = useRef(null);
    const recognition = useRef(null);
    const captionsContainerRef = useRef(null);
    const listenersRef = useRef([]);

    // --- Firebase Initialization & Auth ---
    useEffect(() => {
        if (Object.keys(firebaseConfig).length > 0) {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);

            const authSub = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    try {
                        const { user } = await signInAnonymously(firebaseAuth);
                        setUserId(user.uid);
                    } catch (error) {
                        console.error("Anonymous sign-in failed:", error);
                        setStatus({ text: 'Authentication Failed', type: 'error' });
                    }
                }
            });
            
            return () => {
                 authSub();
                 listenersRef.current.forEach(unsubscribe => unsubscribe());
            };
        } else {
             console.error("Firebase config is missing. Check your .env file or Render environment variables.");
             setStatus({ text: 'Configuration Error', type: 'error' });
        }

    }, []);
    
    // --- Auto-scroll captions ---
    useEffect(() => {
        if (captionsContainerRef.current) {
            captionsContainerRef.current.scrollTop = captionsContainerRef.current.scrollHeight;
        }
    }, [captions]);
    
    // --- Utility to update status ---
    const updateStatus = (text, type) => setStatus({ text, type });

    const hangUp = useCallback(async () => {
        listenersRef.current.forEach(unsubscribe => unsubscribe());
        listenersRef.current = [];

        if(pc.current) {
            pc.current.close();
            pc.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if(recognition.current) {
           recognition.current.stop();
        }

        setLocalStream(null);
        setRemoteStream(null);
        setCallId('');
        setCaptions([]);
        setIsRecognizing(false);
        setMode('home');
        updateStatus('Ready', 'idle');
    }, [localStream, db, callId]);

    // --- Core WebRTC & Signaling Logic ---
    const setupCall = useCallback(async (isCreator, id, lang) => {
        if (!db || !userId) return;
        setMode('in-call');
        setCallId(id);
        setTargetLanguage(lang);
        updateStatus('Initializing...', 'connecting');

        pc.current = new RTCPeerConnection(servers);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
        } catch (error) {
            console.error("Error accessing media devices.", error);
            updateStatus('Media devices permission denied', 'error');
            setTimeout(hangUp, 3000);
            return;
        }

        pc.current.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        const callDocRef = doc(db, 'artifacts', appId, 'public/data/calls', id);
        const offerCandidatesCol = collection(callDocRef, 'offerCandidates');
        const answerCandidatesCol = collection(callDocRef, 'answerCandidates');
        
        pc.current.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(isCreator ? offerCandidatesCol : answerCandidatesCol, event.candidate.toJSON());
            }
        };

        if (isCreator) {
            updateStatus('Creating call...', 'connecting');
            const offerDescription = await pc.current.createOffer();
            await pc.current.setLocalDescription(offerDescription);
            await setDoc(callDocRef, { offer: { sdp: offerDescription.sdp, type: offerDescription.type }, createdAt: serverTimestamp() });
            
            const callSub = onSnapshot(callDocRef, (snapshot) => {
                const data = snapshot.data();
                if (pc.current && !pc.current.currentRemoteDescription && data?.answer) {
                    updateStatus('Connecting...', 'connecting');
                    pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            });
            const answerCandidatesSub = onSnapshot(answerCandidatesCol, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                });
            });
            listenersRef.current.push(callSub, answerCandidatesSub);
            updateStatus('Waiting for participant...', 'connecting');
        } else { // Joiner
            updateStatus('Joining call...', 'connecting');
            const callDoc = await getDoc(callDocRef);
            if (callDoc.exists()) {
                await pc.current.setRemoteDescription(new RTCSessionDescription(callDoc.data().offer));
                const answerDescription = await pc.current.createAnswer();
                await pc.current.setLocalDescription(answerDescription);
                await updateDoc(callDocRef, { answer: { sdp: answerDescription.sdp, type: answerDescription.type } });

                const offerCandidatesSub = onSnapshot(offerCandidatesCol, (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                    });
                });
                listenersRef.current.push(offerCandidatesSub);
            } else {
                 updateStatus('Call ID not found', 'error');
                 setTimeout(hangUp, 3000);
            }
        }
        
        pc.current.onconnectionstatechange = () => {
            if (!pc.current) return;
            const state = pc.current.connectionState;
            if (state === 'connected') updateStatus('Connected', 'connected');
            if (state === 'disconnected' || state === 'closed') {
                updateStatus('Disconnected', 'disconnected');
                hangUp();
            }
            if (state === 'failed') {
                updateStatus('Connection failed', 'error');
                hangUp();
            };
        };

        const captionsCol = collection(callDocRef, 'captions');
        const q = query(captionsCol, orderBy('createdAt', 'asc'), limit(50));
        const captionsSub = onSnapshot(q, (snapshot) => {
            const newCaptions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCaptions(newCaptions);
        });
        listenersRef.current.push(captionsSub);

    }, [db, userId, hangUp]);


    // --- Action Handlers ---
    
    const handleCreateCall = useCallback(async (lang) => {
        if (!db) return;
        const callDocRef = doc(collection(db, 'artifacts', appId, 'public/data/calls'));
        await setupCall(true, callDocRef.id, lang);
    }, [db, setupCall]);

    const handleJoinCall = useCallback(async (id, lang) => {
        await setupCall(false, id, lang);
    }, [setupCall]);
    
    const toggleMediaTrack = (type, setter) => {
        if(!localStream) return;
        localStream.getTracks().filter(t => t.kind === type).forEach(track => {
            track.enabled = !track.enabled;
            setter(p => !p);
        });
    };

    // --- Captioning & Translation Logic ---

    const getTranslation = async (text) => {
        const targetLanguageName = LANGUAGES[targetLanguage];
        const prompt = `Translate the following English text to ${targetLanguageName}. Return only the translated text. Text: "${text}"`;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`API error ${response.status}`);
            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "[Translation unavailable]";
        } catch (error) {
            console.error('Translation failed:', error);
            return "[Translation failed]";
        }
    };

    const toggleRecognition = () => {
        if (isRecognizing) {
            recognition.current?.stop();
        } else {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                updateStatus("Speech recognition not supported here", 'error');
                return;
            }

            recognition.current = new SpeechRecognition();
            recognition.current.lang = 'en-US';
            recognition.current.interimResults = false;
            recognition.current.continuous = true;

            recognition.current.onstart = () => {
                setIsRecognizing(true);
                updateStatus('Listening...', 'connected');
            };

            recognition.current.onresult = async (event) => {
                const transcript = event.results[event.results.length - 1][0].transcript.trim();
                if (transcript) {
                    const translated = await getTranslation(transcript);
                    const callDocRef = doc(db, 'artifacts', appId, 'public/data/calls', callId);
                    await addDoc(collection(callDocRef, 'captions'), {
                        original: transcript, translated, senderId: userId,
                        targetLanguage, createdAt: serverTimestamp()
                    });
                }
            };
            
            recognition.current.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                updateStatus(`Recognition Error: ${event.error}`, 'error');
                setIsRecognizing(false);
            };

            recognition.current.onend = () => {
                setIsRecognizing(false);
                if (status.type === 'connected') updateStatus('Connected', 'connected');
            };
            
            recognition.current.start();
        }
    };
    
    // --- UI Rendering ---

    if (!userId || !db) {
        return (
            <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="ml-4">Connecting to Services...</p>
            </div>
        );
    }
    
    if (mode === 'home') {
        return <HomeScreen onJoin={handleJoinCall} onCreate={handleCreateCall} userId={userId} />;
    }

    // Call Screen
    const statusColor = {
        idle: 'bg-gray-500', connecting: 'bg-yellow-500',
        connected: 'bg-green-500', error: 'bg-red-500', disconnected: 'bg-red-500'
    }[status.type];

    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col p-4 gap-4 font-sans">
            {/* Main Content Area */}
            <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden">
                {/* Video Area */}
                <div className="flex-grow flex flex-col gap-4 relative">
                    <VideoPlayer stream={remoteStream} placeholderText="Waiting for the other participant..." />
                    <div className="absolute bottom-6 right-6 w-1/4 max-w-[240px] aspect-video">
                       <VideoPlayer stream={localStream} isMuted={true} placeholderText="Your Camera" />
                    </div>
                     <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 p-2 rounded-lg">
                        <div className={`w-3 h-3 rounded-full ${statusColor} transition-colors`}></div>
                        <span className="text-sm">{status.text}</span>
                    </div>
                </div>

                {/* Captions Panel */}
                <div className="w-full md:w-96 flex flex-col bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-gray-700">
                        <h2 className="text-xl font-bold flex items-center gap-2"><MessageSquare size={22}/> Captions</h2>
                    </div>
                    <div ref={captionsContainerRef} className="flex-grow p-4 overflow-y-auto">
                        {captions.length === 0 && (
                            <div className="text-center text-gray-400 h-full flex flex-col items-center justify-center">
                                <MessageSquare size={48} className="mb-4 opacity-30"/>
                                <p>Captions will appear here.</p>
                            </div>
                        )}
                        {captions.map((cap) => <CaptionBubble key={cap.id} caption={cap} localUserId={userId} />)}
                    </div>
                    <div className="p-4 border-t border-gray-700 space-y-3">
                        <LanguageSelector value={targetLanguage} onChange={setTargetLanguage} disabled={isRecognizing} />
                        <button onClick={toggleRecognition} disabled={status.type !== 'connected'}
                            className={`w-full py-3 rounded-lg font-bold text-white transition flex items-center justify-center gap-2
                                ${isRecognizing ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}
                                disabled:bg-gray-600 disabled:cursor-not-allowed`}>
                            {isRecognizing ? 'Stop Captions' : 'Start Captions'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex-shrink-0 flex items-center justify-center bg-gray-800 p-2 rounded-lg gap-4 relative">
                <IconButton onClick={() => toggleMediaTrack('audio', setIsMuted)} className={isMuted ? 'bg-red-500' : 'bg-gray-600 hover:bg-gray-500'} text={isMuted ? 'Unmute' : 'Mute'}>
                    {isMuted ? <MicOff /> : <Mic />}
                </IconButton>
                <IconButton onClick={() => toggleMediaTrack('video', setIsCameraOff)} className={isCameraOff ? 'bg-red-500' : 'bg-gray-600 hover:bg-gray-500'} text={isCameraOff ? 'Cam On' : 'Cam Off'}>
                    {isCameraOff ? <VideoOff /> : <Video />}
                </IconButton>
                 <IconButton onClick={hangUp} className="bg-red-600 hover:bg-red-700" text="End Call">
                    <PhoneOff />
                </IconButton>
                <div className="absolute right-4 md:right-8">
                     <button onClick={() => navigator.clipboard.writeText(callId)} className="group flex items-center gap-2 text-xs bg-gray-700 p-2 rounded-lg hover:bg-gray-600">
                        <Copy size={14} /> <span className="font-mono hidden md:inline">{callId}</span>
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">Copy ID</span>
                     </button>
                </div>
            </div>
        </div>
    );
}
