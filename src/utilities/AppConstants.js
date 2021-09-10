module.exports = {
    ServerConstants: {
        THEINSTASHARE_GROUP_NAMES: {
            P2P: 'p2p',
            GROUP_CHAT: 'group_chat'
        },
        CURRENT_GROUP: 'currentGroup',
        SOCKET_SERVER_PORT_START_RANGE: 9090,
        EXPRESS_PORT: 9191,
        API_BASE_URL: "/instashare/users/",
        REDIS_IP: "127.0.0.1",
        REDIS_PORT: "6379",
        CANDIDATES: "candidates",
        CONNECTION: "connection",
        CHANNEL: "channel",
        SOCKET: "socket",
        ERRORS: "errors",
        LOG_TYPES: {
            DEBUG: "debug",
            ERROR: "error"
        },
        IPC_MESSAGE_TYPES: {
            LOG: 'log',
            STICKY_SESSION: 'sticky',
            WORKER_MESSAGE: 'worker',
            GROUP_REGISTER: 'group-register',
            BROADCAST_MESSAGE: 'broadcast'
        },
        RTC_SERVER: "rtc_server",
        STUN_CONFIG: {
            'iceServers': [{
                'urls': 'stun:numb.viagenie.ca:3478'
            },
            {
                'urls': 'stun:stun.l.google.com:19302'
            },
            {
                'urls': 'turn:numb.viagenie.ca:3478',
                'credential': 'sharepro@012',
                'username': 'ironman0693@gmail.com'
            }
            ]
        }
    },
    MessageConstants: {
        OFFER: "offer",
        REGISTER: "register",
        DEREGISTER: "deregister",
        ACKNOWLEDGEMENT: "ack",
        SCREEN: "screen",
        AUDIO: "audio",
        TEXT: "text",
        RECORD: "record",
        LEAVE: "leave",
        ANSWER: "answer",
        CANDIDATE: "candidate",
        CREATE_CHANNEL: "create_channel",
        USER: "user",
        CALL_REQUEST: "call_request"
    },
    RTCEnumConstants: {
        OPEN: "open",
        FAILED: "failed",
        DISCONNECTED: "disconnected",
        CLOSED: "closed",
    },
    StatusConstants: {
        SERVER_ERR: 500,
        MESSAGE_ERR: 422,
        NOT_FOUND_ERR: 404,
        SUCCESS: 200
    }
};
