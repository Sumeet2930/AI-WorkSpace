import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import userModel from './models/user.model.js';
import { generateResult } from './services/ai.service.js';

const port = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});


io.use(async (socket, next) => {

    try {

        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[ 1 ];
        const projectId = socket.handshake.query.projectId;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid projectId'));
        }


        socket.project = await projectModel.findById(projectId);


        if (!token) {
            return next(new Error('Authentication error'))
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded) {
            return next(new Error('Authentication error'))
        }


        // decoded token only contains email; fetch full user (including _id)
        const dbUser = await userModel.findOne({ email: decoded.email }).select('email');
        if (!dbUser) {
            return next(new Error('Authentication error'))
        }

        socket.user = {
            _id: dbUser._id,
            email: dbUser.email
        };

        next();

    } catch (error) {
        next(error)
    }

})

// Ensure an AI user exists in the database so AI messages can be saved as a valid user reference
let aiUser = null;
const AI_EMAIL = 'ai@system.local';

const ensureAiUser = async () => {
    try {
        aiUser = await userModel.findOne({ email: AI_EMAIL });
        if (!aiUser) {
            aiUser = await userModel.create({ email: AI_EMAIL });
            console.log('Created AI user:', aiUser.email);
        } else {
            console.log('AI user exists:', aiUser.email);
        }
    } catch (err) {
        console.error('Failed to ensure AI user:', err);
    }
}

ensureAiUser();


io.on('connection', socket => {
    socket.roomId = socket.project._id.toString()


    console.log('a user connected');



    socket.join(socket.roomId);
    console.log(`User ${socket.user.email} joined room ${socket.roomId}`);

    socket.on('project-message', async data => {

        const message = String(data.message ?? '');
        console.log(`Message received from ${socket.user.email} in room ${socket.roomId}: ${message}`);

        try {
            const project = await projectModel.findById(socket.roomId);
            project.messages.push({
                sender: socket.user._id,
                message: data.message
            });
            await project.save();
        } catch (err) {
            console.log("Error saving message:", err);
        }

        const aiIsPresentInMessage = message.includes('@ai');
        // Broadcast a normalized message object so clients have sender email available
        const outbound = {
            message: data.message,
            sender: {
                _id: socket.user._id,
                email: socket.user.email
            }
        }

        // Emit to everyone in the room INCLUDING the sender so their UI updates too
        io.to(socket.roomId).emit('project-message', outbound)
        console.log(`Message emitted to room ${socket.roomId} from ${socket.user.email}`);

        if (aiIsPresentInMessage) {


            const prompt = message.replace('@ai', '').trim();

            let result;
            try {
                result = await generateResult(prompt);
            } catch (err) {
                console.error('AI generateResult failed:', err);
                io.to(socket.roomId).emit('project-message', {
                    message: `AI error: ${err?.message || 'Failed to generate response'}`,
                    sender: {
                        _id: 'ai',
                        email: 'AI'
                    }
                })
                return
            }

            try {
                const project = await projectModel.findById(socket.roomId);

                // Save AI message using the AI user's ObjectId if available
                const aiSenderId = aiUser?._id || (await userModel.findOne({ email: AI_EMAIL }))._id;

                if (aiSenderId) {
                    project.messages.push({
                        sender: aiSenderId,
                        message: result
                    });
                    await project.save();
                } else {
                    console.warn('AI user id not available; skipping DB save for AI message');
                }
            } catch (err) {
                 console.log("Error saving AI message:", err);
            }

            // Emit AI message to clients using a lightweight AI sender object so frontend shows 'AI'
            io.to(socket.roomId).emit('project-message', {
                message: result,
                sender: {
                    _id: 'ai',
                    email: 'AI'
                }
            })

            return
        }


    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
        socket.leave(socket.roomId)
    });
});




server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})