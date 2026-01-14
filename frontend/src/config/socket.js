import socket from 'socket.io-client';


let socketInstance = null;


export const initializeSocket = (projectId) => {

    // Reuse existing socket if already connected to avoid duplicate connections
    if (socketInstance && socketInstance.connected) {
        return socketInstance
    }

    socketInstance = socket(import.meta.env.VITE_API_URL, {
        auth: {
            token: localStorage.getItem('token')
        },
        query: {
            projectId
        }
    });

    return socketInstance;

}

export const receiveMessage = (eventName, cb) => {
    socketInstance.on(eventName, cb);
}

export const sendMessage = (eventName, data) => {
    if (!socketInstance) {
        console.warn('Socket not initialized. Cannot send message:', eventName, data)
        return false
    }

    try {
        socketInstance.emit(eventName, data)
        return true
    } catch (err) {
        console.error('Error emitting socket event', eventName, err)
        return false
    }
}