import React, { useState, useEffect } from 'react'; 
import { useNavigate, useLocation } from 'react-router-dom'; 
import "./Style/Conversation.css"; 
import Title from "./Components/Title.jsx"; 
import Button from "./Components/Button.jsx";
import AudioIcon from "./Components/AudioIcon.jsx"; 
import 'regenerator-runtime';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import Transcript from "./Components/Transcript.jsx";
import settings from './helpers/helpers.js';
//import AudioPlayer from "./Components/AudioPlayer.jsx";

function Conversation() {
  const navigate = useNavigate(); 
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const [analyzer, setAnalyzer] = useState(null);
  const [amplitude, setAmplitude] = useState(0);
  const [animationId, setAnimationId] = useState(null); // Useful for cancelling animation
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState(["English", "en-US"]);
  const [prompt, setPrompt] = useState("");
  // fetch settings user chose
  const location = useLocation();


  useEffect(() => {
    const { language, proficiency } = location.state || {};
    console.log("Language:", language);
    console.log("Proficiency:", proficiency);
    let code = "";
    let prompt = "";
    switch (language) {
      case "English":
        code = "en-US"
        prompt += settings[0][0].english
        break;
      case "French":
        code = "fr-FR"
        prompt += settings[0][1].french
        break;
      case "Spanish":
        code = "es-US"
        prompt += settings[0][2].spanish
        break;
    }
    switch (proficiency) {
      case "Beginner":
        prompt += settings[1][0].beginner
        break;
      case "Intermediate":
        prompt += settings[1][1].intermediate;
        break;
      case "Advanced":
        prompt += settings[1][2].advanced;
        break;
    }
    setCurrentLanguage([language, code]);
    setPrompt(prompt);
    console.log(prompt);
  }, []);
  // setup recognizer object
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  function textToSpeech(text, lang = 'fr-FR') {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (audioContext && analyzer) {
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateDataArray = () => {
        analyzer.getByteFrequencyData(dataArray);

        // Calculating average amplitude
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const averageAmplitude = sum / dataArray.length;
        setAmplitude(averageAmplitude);

        const id = requestAnimationFrame(updateDataArray);
        setAnimationId(id);
      };
      updateDataArray();
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId); // Stop the animation when recording stops
      }
    };
  }, [audioContext, analyzer]);

  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  async function startRecording() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });  

        // Create AudioContext and AnalyserNode
        const context = new AudioContext();
        const analyzer = context.createAnalyser();
        const source = context.createMediaStreamSource(stream);
        source.connect(analyzer);

        // Set state
        setAudioContext(context);
        setAnalyzer(analyzer);

        const recorder = new MediaRecorder(stream);
        const chunks = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onstart = () => {
          setIsRecording(true);
          SpeechRecognition.startListening({ language: 'fr-FR' });
        };

        recorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          setIsRecording(false);
        };

        setMediaRecorder(recorder);
        recorder.start();
      } catch (error) {
        console.error('Error accessing audio devices:', error);
      }
    } else {
      console.error('getUserMedia not supported in this browser.');
    }
  }

  function stopRecording() {
    SpeechRecognition.stopListening();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (animationId) {
      cancelAnimationFrame(animationId);
      setAnimationId(null); // Clear the animation ID
    }

    // Send the transcript to the backend server in Flask
    fetch('http://127.0.0.1:5000/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: transcript, // Send transcript (** TODO: prepend a prompt depending on proficiency level **)
        conversation_history: conversationHistory, // Send current conversation history.
      }),
    })
      .then(response => response.json())
      .then(data => {
        console.log('Response from backend:', data);
        // Update the conversation history with new response
        setConversationHistory(data.new_history);
        textToSpeech(data.text); // Convert response to speech
      })
      .catch(error => console.error('Error:', error));
  }

  function backClick() { 
    navigate('/');
  }

  function transcriptBtn(event) {
    if (event.target.innerText === "Show Transcript") {
      document.querySelector("button[name='Show Transcript']").innerText = "Hide Transcript";
      document.querySelector("button[name='Show Transcript']").name = "Hide Transcript";
    } else {
      document.querySelector("button[name='Hide Transcript']").innerText = "Show Transcript";
      document.querySelector("button[name='Hide Transcript']").name = "Show Transcript";
    }
  }

  return (
    <>
      <div id="banner">
        <Title hasBio={false}/>
        <Button name="Change Settings" style={{backgroundColor: '#FFC000', border: 'none', width: '18%', marginTop: '-1%', fontSize: '150%', height: '50px'}} handleClick={backClick}/>
      </div>
      
      <div id="main-content">
        <div id="icon-chat-container">
          <div id="audio-icon-container" className="cell">
            <AudioIcon amplitude={amplitude} />
          </div>
          <div id="transcript-container">
            <Transcript conversation={conversationHistory}/>
          </div>   
        </div>
      </div>

      <div id="convo-btns">
        <Button handleClick={isRecording ? stopRecording : startRecording} name={isRecording ? "Stop Recording" : "Start Recording"}/>
        <Button handleClick={transcriptBtn} name="Show Transcript" />
      </div>
      
      <div id="convo-btns-bottom">
        <Button name="End Conversation" handleClick={resetTranscript}/>
      </div>

      <div>
        <h3>Recorded Audio:</h3>
        {audioUrl && <audio controls src={audioUrl} />}
      </div>
      <p>Transcript: {transcript}</p>
      {console.log(conversationHistory)}
      <ul>
        {conversationHistory.map(item => {
          return <li>{item}</li>
        })}
      </ul>

    </>
  ); 
} 

export default Conversation;
