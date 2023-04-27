package rtmp

import (
	"fmt"
	"github.com/nareix/joy5/av"
	"github.com/nareix/joy5/format/flv"
	"github.com/nareix/joy5/format/flv/flvio"
	log "github.com/sirupsen/logrus"
	"io"
	"net"
	"time"

	"github.com/nareix/joy5/format/rtmp"
	"github.com/owncast/owncast/config"
	"github.com/owncast/owncast/core/data"
	"github.com/owncast/owncast/models"
)

const (
	FREE = iota // Can accept new stream
	BUSY = iota // Cannot accept new stream
	DEAD = iota // Can accept new stream because the previous one is unresponsive
)

var _rtmpState = FREE

//var _hasInboundRTMPConnection = false

var (
	_pipe           *io.PipeWriter
	_rtmpConnection net.Conn
)

var (
	_setStreamAsConnected func(*io.PipeReader)
	_setBroadcaster       func(models.Broadcaster)
)

type packetRes struct {
	pkt av.Packet
	err error
}

// Start starts the rtmp service, listening on specified RTMP port.
func Start(setStreamAsConnected func(*io.PipeReader), setBroadcaster func(models.Broadcaster)) {
	_setStreamAsConnected = setStreamAsConnected
	_setBroadcaster = setBroadcaster

	port := data.GetRTMPPortNumber()
	s := rtmp.NewServer()
	var lis net.Listener
	var err error
	if lis, err = net.Listen("tcp", fmt.Sprintf(":%d", port)); err != nil {
		log.Fatal(err)
	}

	s.LogEvent = func(c *rtmp.Conn, nc net.Conn, e int) {
		es := rtmp.EventString[e]
		log.Traceln("RTMP", nc.LocalAddr(), nc.RemoteAddr(), es)
	}

	s.HandleConn = HandleConn

	if err != nil {
		log.Panicln(err)
	}
	log.Tracef("RTMP server is listening for incoming stream on port: %d", port)

	for {
		nc, err := lis.Accept()
		if err != nil {
			time.Sleep(time.Second)
			continue
		}
		go s.HandleNetConn(nc)
	}
}

// HandleConn is fired when an inbound RTMP connection takes place.
func HandleConn(c *rtmp.Conn, nc net.Conn) {
	c.LogTagEvent = func(isRead bool, t flvio.Tag) {
		if t.Type == flvio.TAG_AMF0 {
			log.Tracef("%+v\n", t.DebugFields())
			setCurrentBroadcasterInfo(t, nc.RemoteAddr().String())
		}
	}

	// Server is either already connected or in grace period
	if _rtmpState == BUSY {
		log.Errorln("stream already running; can not overtake an existing stream")
		_ = nc.Close()
		return
	}

	defer handleDisconnect(nc)

	// Previous connection is dead, kill it
	if _rtmpConnection != nil {
		fmt.Println("Killing the previous connection")
		handleDisconnect(_rtmpConnection)
	}

	accessGranted := false
	validStreamingKeys := data.GetStreamKeys()

	// If a stream key override was specified then use that instead.
	if config.TemporaryStreamKey != "" {
		validStreamingKeys = []models.StreamKey{{Key: config.TemporaryStreamKey}}
	}

	for _, key := range validStreamingKeys {
		if secretMatch(key.Key, c.URL.Path) {
			accessGranted = true
			break
		}
	}

	if !accessGranted {
		log.Errorln("invalid streaming key; rejecting incoming stream")
		return
	}

	rtmpOut, rtmpIn := io.Pipe()
	_pipe = rtmpIn
	log.Infoln("Inbound stream connected.")
	_setStreamAsConnected(rtmpOut)

	//_hasInboundRTMPConnection = true

	// Give 10 seconds of grace period to the accepted stream
	// mutex?
	_rtmpState = BUSY
	_rtmpConnection = nc

	w := flv.NewMuxer(rtmpIn)

	packets := make(chan packetRes, 1)

	go func() {
		for {
			pkg, err := c.ReadPacket()
			packets <- packetRes{pkg, err}

			if err != nil {
				return
			}
		}
	}()

	select {
	case packet := <-packets:
		if !handlePacket(w, packet) {
			return
		}
	case <-time.After(10 * time.Second):
		log.Infoln("Haven't received a valid package for 10 seconds. Accepting new connections")
		_rtmpState = FREE
	}

	for packet := range packets {
		if !handlePacket(w, packet) {
			return
		}
	}
}

func handlePacket(w *flv.Muxer, packet packetRes) bool {
	// Broadcaster
	//ed
	if packet.err == io.EOF {
		return false
	}

	// Read timeout.  Disconnect.
	if neterr, ok := packet.err.(net.Error); ok && neterr.Timeout() {
		log.Debugln("Timeout reading the inbound stream from the broadcaster.  Assuming that they disconnected and ending the stream.")
		return false
	}

	if err := w.WritePacket(packet.pkt); err != nil {
		log.Errorln("unable to write rtmp packet", err)
		return false
	}

	return true
}

func handleDisconnect(conn net.Conn) {
	// May not be necessary
	if _rtmpState == FREE {
		return
	}

	log.Infoln("Inbound stream disconnected.")
	_ = conn.Close()
	_ = _pipe.Close()
	//_hasInboundRTMPConnection = false
	_rtmpState = FREE
}

// Disconnect will force disconnect the current inbound RTMP connection.
func Disconnect() {
	if _rtmpConnection == nil {
		return
	}

	log.Traceln("Inbound stream disconnect requested.")
	handleDisconnect(_rtmpConnection)
}
