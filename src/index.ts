import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

function makeId () {
  return Math.random().toString(36).slice(6)
}

const httpServer = createServer()

const io = new Server(httpServer, { cors: { origin: '*' } })

type RoomDataType = {pcPlayer: string, mobilePlayer: string}

const roomData = new Map<string, RoomDataType>()

function createRoom (roomId: string, pcPlayer: string) {
  roomData.set(roomId, { pcPlayer, mobilePlayer: '' })
}

function addMobile (roomId: string, mobilePlayer: string): boolean {
  const room = roomData.get(roomId)
  if (room && room.mobilePlayer.length === 0) {
    room.mobilePlayer = mobilePlayer
    return true
  }

  return false
}

io.on('connection', (socket: Socket) => {
  console.log('new connection :', socket.id)
  const roomId = makeId()
  createRoom(roomId, socket.id)

  setTimeout(() => {
    socket.emit('message', JSON.stringify({ roomId }))
  }, 1000)

  socket.on('disconnect', () => {
    io.of('/' + roomId).to(roomId).emit('message', 'shutdown')
    console.log('disconnect :', socket.id)
  })

  socket.on('message', msg => {
    io.of('/' + roomId).to(roomId).emit('message', msg)
    console.log(`forwarding message from [${socket.id}] to namespace [${roomId}]`)
  })
})

io.of(/^\/\w+$/).on('connection', (socket: Socket) => {
  const namespace = socket.nsp.name.substring(1)
  const room = roomData.get(namespace)
  console.log(socket.id, 'try to join', namespace)
  if (!room) {
    socket.emit('404')
    console.log('404, room not found :', namespace)
    socket.disconnect()
    return
  }
  console.log('Room found !')

  addMobile(namespace, socket.id)
  socket.join(namespace)

  socket.on('message', msg => {
    io.sockets.sockets.get(room.pcPlayer)?.emit('message', msg)
    console.log(`forwarding message from [${socket.id}] to pcPlayer [${room.pcPlayer}]`)
  })

  socket.on('disconnect', () => {
    console.log(`mobilePlayer [${socket.id}] disconnected from namespace [${namespace}]`)
  })
})

const port = 3000
httpServer.listen(port, '127.0.0.1', () => { console.log(`listening on *:${port}`) })
