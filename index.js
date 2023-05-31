let APP_ID = "cf2a8c06d628473da23185d8f1c7fa96";
let token = null;
let uid = String(Math.floor(Math.random() * 10000));
let client;
let channel;

let queryString=window.location.search
let urlParams=new URLSearchParams(queryString)
let roomId=urlParams.get('room')
let pendingCandidates = [];
if(!roomId){
    window.location='lobby.html'   
}

let localStream;
let remoteStream;
let peerConnection;
const servers = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};
let quality={
       video:{
              width:{min:640,ideal:1920,max:1920},
              height:{min:480,ideal:1080,max:1080}
       },audio:true
}
let init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });
  //to create many channel we csn pass index.html?room=1234
  channel = client.createChannel(roomId);
  await channel.join();
  channel.on("MemberJoined", handleUserJoined);
  channel.on("MemberLeft", handleUserLeft);
  
  client.on("MessageFromPeer", handleMessageFromPeer);
  localStream = await navigator.mediaDevices.getUserMedia(quality);
  document.getElementById("user-1").srcObject = localStream;
};

let handleUserLeft=async(MemberId)=>{
       document.getElementById("user-2").style.display='none'    
       document.getElementById("user-1").classList.remove('smallFrame')
}


let handleMessageFromPeer = async (message, MemberId) => {
  message = await JSON.parse(message.text);
  console.log("message :", message);
  if (message.type === "offer") {
    createAnswer(MemberId, message.offer);
  }
  if (message.type === "answer") {
    addAnswer(message.answer);
  }
  if (message.type === "candidate") {
    if (peerConnection && peerConnection.remoteDescription) {
      peerConnection.addIceCandidate(message.candidate);
    } else {
      // Store the candidate and add it later when the remote description is set
      pendingCandidates.push(message.candidate);
    }
  }
};


//now connecting peers to peers connection
let handleUserJoined = async (MemberId) => {
  console.log("new user is joined whit the id of ", MemberId);
  createOffer(MemberId);
};
 
let createPeerConnections= async (MemberId)=>{
       peerConnection = new RTCPeerConnection(servers);

       remoteStream = new MediaStream();
       document.getElementById("user-2").srcObject = remoteStream;
       document.getElementById("user-2").style.display='block'
       document.getElementById("user-1").classList.add('smallFrame')
       if (!localStream) {
               // create a new local stream
        localStream = await navigator.mediaDevices.getUserMedia({
       video: true,
       audio: true,
     });
     document.getElementById('user-1').srcObject = localStream
       }
     
       localStream.getTracks().forEach((track) => {
         peerConnection.addTrack(track, localStream);
       });
       peerConnection.ontrack = (event) => {
         event.streams[0].getTracks().forEach((track) => {
           remoteStream.addTrack(track);
         });
       };
       peerConnection.onicecandidate = async (event) => {
         if (event.candidate) {
           client.sendMessageToPeer(
             {
               text: JSON.stringify({
                 type: "candidate",
                 candidate: event.candidate,
               }),
             },
             MemberId
           );
         }
       };
}

let createOffer = async (MemberId) => {
  await createPeerConnections(MemberId);
  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  //console.log('offer:',offer)
  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "offer", "offer": offer }) },
    MemberId
  );
};

let createAnswer = async (MemberId, offer) => {
  await createPeerConnections(MemberId);
  await peerConnection.setRemoteDescription(offer);

  let answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "answer", answer: answer }) },
    MemberId
  );

  // Add any pending ICE candidates after the remote description is set
  for (const candidate of pendingCandidates) {
    peerConnection.addIceCandidate(candidate);
  }
  pendingCandidates = [];
};

let addAnswer=async(answer)=>{
 if(!peerConnection.currentRemoteDescription){
       peerConnection.setRemoteDescription(answer)
 }
}
let leaveChannel=async()=>{
    await channel.leave()
    await client.logout()  
}
 let togglecamera= async()=>{
    let videotrack=  localStream.getTracks().find(track=>track.kind==='video')
    if(videotrack.enabled){
       videotrack.enabled=false;
       document.getElementById('camera-btn').style.opacity='0.5';
    }
    else{
       videotrack.enabled=true;
       document.getElementById('camera-btn').style.opacity='1';
    }  
 }
 let toggleMic= async()=>{
    let Audiotrack=  localStream.getTracks().find(track=>track.kind==='audio')
    if(Audiotrack.enabled){
       Audiotrack.enabled=false;
       document.getElementById('mic-btn').style.opacity='0.5';
    }
    else{
       Audiotrack.enabled=true;
       document.getElementById('mic-btn').style.opacity='1';
    }  
 }

window.addEventListener('beforeunload',leaveChannel)
document.getElementById('camera-btn').addEventListener('click',togglecamera)
document.getElementById('mic-btn').addEventListener('click',toggleMic)
init();
