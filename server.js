const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, 'chat.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const chatProto = grpc.loadPackageDefinition(packageDefinition).chat;

const admin = {
    id: "admin",
    name: "Grpc_Admin",
    email: "grpc_admin@mail.com",
    status: "ACTIVE",
};

// Stockage des messages pour l'historique
const chatHistory = [];

function getUser(call, callback) {
    const userId = call.request.user_id;
    console.log(`Requête GetUser reçue pour id: ${userId}`);
    const user = { ...admin, id: userId };
    callback(null, { user });
}

function chat(call) {
    console.log("Flux Chat démarré.");
    call.on('data', (chatStreamMessage) => {
        if (chatStreamMessage.chat_message) {
            const msg = chatStreamMessage.chat_message;
            console.log(`Message reçu de ${msg.sender_id}: ${msg.content}`);
            
            // Ajout du message à l'historique
            chatHistory.push(msg);
            if (chatHistory.length > 100) { // Limite à 100 messages
                chatHistory.shift();
            }

            const reply = {
                id: msg.id + ".reply",
                room_id: msg.room_id,
                sender_id: admin.name,
                content: "received at " + new Date().toISOString(),
            };
            call.write({ chat_message: reply });
        }
    });
    call.on('end', () => {
        console.log("Fin du flux Chat.");
        call.end();
    });
}

// Nouvelle méthode pour l'historique
function getChatHistory(call, callback) {
    const { room_id, limit = 10 } = call.request;
    console.log(`Requête d'historique pour la salle ${room_id}, limite ${limit}`);
    
    const filteredMessages = chatHistory
        .filter(msg => msg.room_id === room_id)
        .slice(-limit);
    
    callback(null, { messages: filteredMessages });
}

function main() {
    const server = new grpc.Server();
    server.addService(chatProto.ChatService.service, {
        GetUser: getUser,
        Chat: chat,
        GetChatHistory: getChatHistory,
    });
    const address = '0.0.0.0:50051';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (error, port) => {
        if (error) {
            console.error("Erreur lors du binding du serveur :", error);
            return;
        }
        console.log(`Serveur gRPC en écoute sur ${address}`);
        server.start();
    });
}
main();