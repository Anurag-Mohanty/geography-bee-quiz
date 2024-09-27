import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiUrl } from './utils';
import './App.css';

function App() {
  const [questions, setQuestions] = useState([]);
  const [gameState, setGameState] = useState('initial');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentClueIndex, setCurrentClueIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [timer, setTimer] = useState(0);
  const [clueTimes, setClueTimes] = useState([]);
  const [error, setError] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [name, setName] = useState('');
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);

  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const fetchQuestions = useCallback(async () => {
    try {
      const apiUrl = await getApiUrl();
      const response = await axios.get(`${apiUrl}/api/questions`, {
        params: { pageSize: 20 },
      });
      if (Array.isArray(response.data.questions) && response.data.questions.length > 0) {
        setQuestions(response.data.questions);
      } else {
        throw new Error('No questions received from the server');
      }
    } catch (error) {
      setError(`Failed to fetch questions. ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    let interval;
    if (gameState === 'playing') {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer + 1);
        setClueTimes((prevTimes) => {
          const newTimes = [...prevTimes];
          newTimes[currentClueIndex] = (newTimes[currentClueIndex] || 0) + 1;
          return newTimes;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, currentClueIndex]);

  const startGame = async () => {
    if (!name) {
      setError('Please enter your name to start the quiz.');
      return;
    }
    setError(null);
    setGameState('loading');
    await fetchQuestions();
    if (questions.length > 0) {
      setGameState('playing');
      setCurrentQuestionIndex(0);
      setCurrentClueIndex(0);
      setScore(0);
      setTimer(0);
      setClueTimes([]);
      setUserAnswer('');
    } else {
      setError('Unable to load questions. Please try again.');
      setGameState('initial');
    }
  };

  const checkAnswer = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) {
      setFeedback('No question available. Please try again.');
      return;
    }

    const correctAnswers = currentQuestion.answer.toLowerCase().split(/[()]/);
    const isCorrect = correctAnswers.some((answer) =>
      fuzzyMatch(userAnswer.toLowerCase(), answer.trim())
    );

    if (isCorrect) {
      const points = 4 - currentClueIndex;
      setScore(score + points);
      let message;
      switch (currentClueIndex) {
        case 0:
          message = 'Excellent!';
          break;
        case 1:
          message = 'Great job!';
          break;
        case 2:
          message = 'Nice!';
          break;
        default:
          message = 'You are correct.';
      }
      setFeedback(`${message} The correct answer is ${currentQuestion.answer}.`);
      setTimeout(nextQuestion, 3000);
    } else {
      if (currentQuestion.clues[currentClueIndex + 1] === 'Additional information not available.') {
        setFeedback(`Incorrect. The correct answer is ${currentQuestion.answer}.`);
        setTimeout(nextQuestion, 3000);
      } else if (currentClueIndex < currentQuestion.clues.length - 1) {
        setCurrentClueIndex(currentClueIndex + 1);
        setFeedback("Incorrect. Here's the next clue.");
      } else {
        setFeedback(`Incorrect. The correct answer is ${currentQuestion.answer}.`);
        setTimeout(nextQuestion, 3000);
      }
    }
    setUserAnswer('');
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentClueIndex(0);
      setFeedback('');
      setClueTimes([]);
    } else {
      saveToLeaderboard();
      setGameState('gameOver');
    }
  };

  const saveToLeaderboard = () => {
    const newEntry = {
      name,
      score,
      time: formatTime(timer),
      date: new Date().toLocaleString(),
    };
    const updatedLeaderboard = [newEntry, ...leaderboard.slice(0, 9)];
    setLeaderboard(updatedLeaderboard);
  };

  const eraseLeaderboard = () => {
    setLeaderboard([]);
  };

  const toggleLeaderboard = () => {
    setLeaderboardVisible(!leaderboardVisible);
  };

  const fuzzyMatch = (input, target) => {
    const inputClean = input.replace(/[^a-z0-9]/g, '');
    const targetClean = target.replace(/[^a-z0-9]/g, '');
    return (
      inputClean === targetClean ||
      (inputClean.length > 3 && targetClean.includes(inputClean)) ||
      (targetClean.length > 3 && inputClean.includes(targetClean))
    );
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderClues = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || !currentQuestion.clues || !Array.isArray(currentQuestion.clues)) {
      return <p>No clues available for this question.</p>;
    }

    return currentQuestion.clues.map((clue, index) => {
      if (clue === 'Additional information not available.') {
        return null;
      }
      return (
        <p
          key={index}
          className={`clue ${
            index === currentClueIndex
              ? 'active'
              : index < currentClueIndex
              ? 'inactive'
              : 'hidden'
          }`}
        >
          <strong>Clue {index + 1}:</strong> {clue}
          <br />
          <small>Source: {currentQuestion.sourceFile}</small>  {/* Add the source file name */}
          {index <= currentClueIndex && <span> (Time: {formatTime(clueTimes[index] || 0)})</span>}
        </p>
      );
    });
  };

  const Leaderboard = () => (
    <div className={`leaderboard ${leaderboardVisible ? 'visible' : 'hidden'}`}>
      <h2>Leaderboard</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Score</th>
            <th>Time</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.length === 0 ? (
            <tr>
              <td colSpan="5">No previous attempts.</td>
            </tr>
          ) : (
            leaderboard.map((entry, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{entry.name}</td>
                <td>{entry.score}</td>
                <td>{entry.time}</td>
                <td>{entry.date}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (gameState === 'initial') {
    return (
      <div className="container">
        <h1>Geography Bee Quiz</h1>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="name-input"
        />
        <button onClick={startGame} className="start-button">
          Begin Quiz
        </button>
        <button onClick={toggleLeaderboard} className="leaderboard-toggle">
          {leaderboardVisible ? 'Hide Leaderboard' : 'Show Leaderboard'}
        </button>
        {leaderboardVisible && <Leaderboard />}
      </div>
    );
  }

  if (gameState === 'loading') {
    return (
      <div className="container">
        <h1>Geography Bee Quiz</h1>
        <p>Loading questions...</p>
      </div>
    );
  }

  if (gameState === 'gameOver') {
    return (
      <div className="container">
        <h1>Game Over!</h1>
        <p>Your final score: {score} out of {questions.length * 4}</p>
        <p>Total time: {formatTime(timer)}</p>
        <button onClick={startGame} className="start-button">
          Play Again
        </button>
        <button onClick={toggleLeaderboard} className="leaderboard-toggle">
          {leaderboardVisible ? 'Hide Leaderboard' : 'Show Leaderboard'}
        </button>
        {leaderboardVisible && <Leaderboard />}
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="container">
        <div className="header-bar">
          <div className="header-item">Score: {score}</div>
          <div className="header-item">Time: {formatTime(timer)}</div>
          <div className="header-item">Question {currentQuestionIndex + 1} of {questions.length}</div>
        </div>

        <h1>Geography Bee Quiz</h1>

        {renderClues()}

        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
          placeholder="Your answer"
          className="answer-input"
        />

        <div className="button-group">
          <button onClick={checkAnswer} className="submit-button">Submit</button>
          <button onClick={() => setCurrentClueIndex((i) => i + 1)} className="clue-button">Skip Clue</button>
          <button onClick={nextQuestion} className="question-button">Skip Question</button>
        </div>

        {feedback && <p className="feedback">{feedback}</p>}

        {questions[currentQuestionIndex] && (
          <small className="source-file">
            Source: {questions[currentQuestionIndex].sourceFile}
          </small>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Geography Bee Quiz</h1>
      <p>Score: {score}</p>
      <p>Question {currentQuestionIndex + 1} of {questions.length}</p>
      <p>Total Time: {formatTime(timer)}</p>
      {renderClues()}
      <input
        type="text"
        value={userAnswer}
        onChange={(e) => setUserAnswer(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
        placeholder="Your answer"
        className="answer-input"
      />
      <div className="button-group">
        <button onClick={checkAnswer} className="submit-button">Submit</button>
        <button onClick={() => setCurrentClueIndex((i) => i + 1)} className="clue-button">
          Skip Clue
        </button>
        <button onClick={nextQuestion} className="question-button">Skip Question</button>
      </div>
      {feedback && <p className="feedback">{feedback}</p>}
      <button onClick={toggleLeaderboard} className="leaderboard-toggle">
        {leaderboardVisible ? 'Hide Leaderboard' : 'Show Leaderboard'}
      </button>
      {leaderboardVisible && <Leaderboard />}
    </div>
  );
}

export default App;