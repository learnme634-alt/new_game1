const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// إضافة الـ CORS (مهم جداً حتى جيت هاب يقدر يتصل بالسيرفر)
const io = new Server(server, {
    cors: {
        origin: "*", // يسمح لأي موقع بالاتصال (تقدر لاحقاً تخلي رابط جيت هاب مالتك فقط)
        methods: ["GET", "POST"]
    }
});

// قراءة الأسئلة من الملف
const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

let players = [];
let currentQuestionIndex = 0;
let scores = {};

function normalizeText(text) {
    return text.trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u064B-\u0652]/g, '').toLowerCase();
}

io.on('connection', (socket) => {
    console.log('لاعب جديد دخل اللعبة، ID:', socket.id);
    
    if (players.length < 2) {
        players.push(socket.id);
        scores[socket.id] = 0;
        socket.emit('status_message', 'تم الاتصال! ننتظر دخول اللاعب الثاني...');
    } else {
        socket.emit('status_message', 'الغرفة ممتلئة حالياً (2/2).');
        return; 
    }

    if (players.length === 2) {
        io.emit('status_message', 'اكتمل العدد! اللعبة ستبدأ الآن 🚀');
        sendNextQuestion();
    }

    socket.on('submit_answer', (spokenText) => {
        const currentQ = questions[currentQuestionIndex];
        const normalizedSpoken = normalizeText(spokenText);
        const isCorrect = currentQ.accepted_answers.map(normalizeText).some(ans => normalizedSpoken.includes(ans));

        if (isCorrect) {
            scores[socket.id] += 10;
            io.emit('answer_result', {
                winnerId: socket.id,
                spokenText: spokenText,
                correctAnswer: currentQ.accepted_answers[0],
                scores: scores
            });
            
            currentQuestionIndex++;
            setTimeout(sendNextQuestion, 3000);
        } else {
            socket.emit('wrong_answer', spokenText);
        }
    });

    socket.on('disconnect', () => {
        console.log('لاعب غادر:', socket.id);
        players = players.filter(id => id !== socket.id);
        io.emit('status_message', 'أحد اللاعبين غادر اللعبة. اللعبة توقفت.');
    });
});

function sendNextQuestion() {
    if (currentQuestionIndex < questions.length) {
        io.emit('new_question', questions[currentQuestionIndex].question);
    } else {
        io.emit('game_over', scores);
    }
}

// تعديل البورت ليكون ديناميكي متوافق مع الاستضافة
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر شغال بامتياز على البورت ${PORT} 🚀`);
});