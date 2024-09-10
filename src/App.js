import React, { useState, useEffect } from 'react';

const allQuestions = [
  {
    clues: [
      "This mountain range's volcano of Licancabur recorded the world's highest UV index in 2003.",
      "This mountain range contains the world's highest permanent settlement at La Rinconada.",
      "This range passes by a lake known either as Lake O'Higgins or Lake San Martin near the province of Santa Cruz.",
      "This South American mountain range is home to Aconcagua."
    ],
    answer: "Andes Mountains",
    alternateAnswers: ["Andean Mountains"]
  },
  // Add more questions here...
];

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentClueIndex, setCurrentClueIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    console.log("Component rendered. Game started:", gameStarted);
  }, [gameStarted]);

  const startGame = () => {
    console.log("Starting game...");
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    setQuestions(shuffled);
    setGameStarted(true);
    console.log("Game started. Questions:", shuffled);
  };

  const checkAnswer = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = [currentQuestion.answer, ...(currentQuestion.alternateAnswers || [])]
      .some(answer => answer.toLowerCase() === userAnswer.toLowerCase());

    if (isCorrect) {
      setScore(score + (4 - currentClueIndex));
      setFeedback('Correct!');
      setTimeout(() => {
        nextQuestion();
      }, 1500);
    } else {
      if (currentClueIndex < currentQuestion.clues.length - 1) {
        setCurrentClueIndex(currentClueIndex + 1);
        setFeedback('Incorrect. Here\'s another clue.');
      } else {
        setFeedback(`Incorrect. The correct answer was ${currentQuestion.answer}.`);
        setTimeout(() => {
          nextQuestion();
        }, 1500);
      }
    }
    setUserAnswer('');
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentClueIndex(0);
      setFeedback('');
    } else {
      setGameStarted(false);
      setFeedback(`Game Over! Your score: ${score}`);
    }
  };

  if (!gameStarted) {
    return (
      <div className="App">
        <h1>Geography Bee Quiz</h1>
        {feedback ? (
          <p>{feedback}</p>
        ) : (
          <button onClick={startGame}>Start Game</button>
        )}
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="App">
      <h1>Geography Bee Quiz</h1>
      <p>Score: {score}</p>
      <p>Question {currentQuestionIndex + 1} of {questions.length}</p>
      <p>{currentQuestion.clues[currentClueIndex]}</p>
      <input
        type="text"
        value={userAnswer}
        onChange={(e) => setUserAnswer(e.target.value)}
        placeholder="Your answer"
      />
      <button onClick={checkAnswer}>Submit</button>
      {feedback && <p>{feedback}</p>}
    </div>
  );
}

export default App;