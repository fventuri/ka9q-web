//
// G0ORX WebSDR using ka9q-radio
//
//
      var ssrc;

      var band;

      var spectrum;
      var spanHz= 20000; // 20000 Hz per bin
      var centerHz=16200000; // center frequency
      var frequencyHz=16200000; // tuned frequency
      var lowHz=0;
      var highHz=32400000;
      var samples=1620;

      var filter_low = 50;
      var filter_high = 3000;
      var power = -120;

      var player = new PCMPlayer({
        encoding: '16bitInt',
        channels: 1,
        sampleRate: 12000,
        flushingTime: 250
        });

      function ntohs(value) {
        const buffer = new ArrayBuffer(2);
        const view = new DataView(buffer);
        view.setUint16(0, value);

        const byteArray = new Uint8Array(buffer);
        const result = (byteArray[0] << 8) | byteArray[1];

        return result;
      }

      function ntohf(value) {
        const buffer = new ArrayBuffer(4);
        view = new DataView(buffer);
        view.setFloat32(0, value);

        const byteArray = new Uint8Array(buffer);
        const result = (byteArray[0] << 24) | (byteArray[1] << 16) | (byteArray[2] << 8) | byteArray[3];

        b0=byteArray[0];
        b1=byteArray[1];
        b2=byteArray[2];
        b3=byteArray[3];
 
        byteArray[0]=b3;
        byteArray[1]=b2;
        byteArray[2]=b1;
        byteArray[3]=b0;
        
        return view.getFloat32(0);
      }

      function ntohl(value) {
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setUint32(0, value);

        const byteArray = new Uint8Array(buffer);
        const result = (byteArray[0] << 24) | (byteArray[1] << 16) | (byteArray[2] << 8) | byteArray[3];

        return result;
      }

      function on_ws_open() {
        // get the SSRC
        ws.send("S:");
        // default to 20 Mtr band
        //document.getElementById('20').click()
        spectrum.setFrequency(parseInt(document.getElementById('freq').value));
        ws.send("M:usb");
      }

      function on_ws_close() {
      }

      async function on_ws_message(evt) {
        if(typeof evt.data === 'string') {
          // text data
          //console.log(evt.data);
          temp=evt.data.toString();
          args=temp.split(":");
          if(args[0]=='S') { // get our ssrc
            ssrc=parseInt(args[1]);
          }
        } else if(evt.data instanceof ArrayBuffer) {
          var data = evt.data;
          //console.log("data.byteLength=",data.byteLength);
          // RTP header
          const view = new DataView(evt.data);
          var i=0;
          var n = view.getUint32(i);
          i=i+4;
          //console.log("n=",n.toString(16));
          var w = ntohl(n);
          //console.log("w=",w.toString(16));
          var version = w>>30;
          var pad = (w>>29)&1;
          var extension = (w>>28)&1;
          var cc = (w>>24)&0x0f;
          var type = (w>>16)&0x7f;
          var seq =  w&0xffff;
          
          n = view.getUint32(i);
          i=i+4;
          var timestamp=ntohl(n);
          n = view.getUint32(i);
          i=i+4;
          var this_ssrc=ntohl(n);
          i=i+cc;
          if(extension) {
            n = view.getUint32(i);
            var ext_len=ntohl(n);
            i=i+4;
            i=i+ext_len;
          }

          // i now points to the start of the data
          var data_length=data.byteLength-i;
          var update=0;
          switch(type) {
            case 0x7F: // SPECTRUM DATA
              n = view.getUint32(i);
              i=i+4;
              var hz = ntohl(n);
              if(centerHz!=hz) {
                centerHz=hz;
                spectrum.setCenterHz(centerHz);
                update=1;
              }

              n = view.getUint32(i);
              i=i+4;
              hz = ntohl(n);
              if(frequencyHz!=hz) {
                frequencyHz=hz;
                spectrum.setFrequency(frequencyHz);
                document.getElementById("freq").value=frequencyHz.toString();
                update=1;
              }

              n = view.getUint32(i);
              i=i+4;
              hz = ntohl(n);;
              if(spanHz!=hz) {
                spanHz=hz;
                spectrum.setSpanHz(spanHz*samples);
                update=1;
              }

              if(update) {
                lowHz=centerHz-((spanHz*samples)/2);
                spectrum.setLowHz(lowHz);
                highHz=centerHz+((spanHz*samples)/2);
                spectrum.setHighHz(highHz);
                info = document.getElementById('info');
                info.innerHTML = "Samples="+samples.toString()+" Hz/sample="+spanHz.toString();
              }

//console.log("center="+String(centerHz)+" freq="+String(frequencyHz)+" span="+String(spanHz)+" low="+String(lowHz)+" high="+String(highHz));
              var dataBuffer = evt.data.slice(i,data.byteLength);
              const arr = new Float32Array(dataBuffer);
              spectrum.addData(arr);
              break;
            case 0x7E: // Channel Data
              while(i<data.byteLength) {
                var v=view.getInt8(i++);
                var l=view.getInt8(i++);
                switch(v) {
                  case 39: // LOW_EDGE
                    dataBuffer = evt.data.slice(i,i+l);
                    arr_low = new Float32Array(dataBuffer);
                    filter_low=ntohf(arr_low[0]);
                    i=i+l;
                    break;
                  case 40: // HIGH_EDGE
                    dataBuffer = evt.data.slice(i,i+l);
                    arr_high = new Float32Array(dataBuffer);
                    filter_high=ntohf(arr_high[0]);
                    i=i+l;
                    break;
                  case 46: // BASEBAND_POWER
                    power=view.getFloat32(i);
                    i=i+l;
                    break;
                }
              }
              spectrum.setFilter(filter_low,filter_high);
              break;
            case 0x7A: // 122 - 16bit PCM Audio at 12000 Hz
              // Audio data 1 channel 12000
              var dataBuffer = evt.data.slice(i,data.byteLength);
              var audio_data=new Uint8Array(dataBuffer,0,data_length);
              // byte swap
              for(i=0;i<data_length;i+=2) {
                var tmp=audio_data[i];
                audio_data[i]=audio_data[i+1];
                audio_data[i+1]=tmp;
              }
              // push onto audio queue
              player.feed(audio_data);
              break;
            default:
              console.log("received unknown type:"+type.toString(16));
              break;
          }
        }
      }
      function on_ws_error() {
      }
      function is_touch_enabled() {
        return ( 'ontouchstart' in window ) || 
               ( navigator.maxTouchPoints > 0 ) ||
               ( navigator.msMaxTouchPoints > 0 );
      }
      init = function(){
        frequencyHz=16200000;
        centerHz=16200000;
        spanHz=20000;
        spectrum = new Spectrum("waterfall",{spectrumPercent: 20});
        spectrum.setSpectrumPercent(50);
        spectrum.setFrequency(frequencyHz);
        spectrum.setCenterHz(centerHz);
        spectrum.setSpanHz(spanHz*samples);
        lowHz=centerHz-((spanHz*samples)/2);
        spectrum.setLowHz(lowHz);
        highHz=centerHz+((spanHz*samples)/2);
        spectrum.setHighHz(highHz);
        //msg=document.getElementById('msg');
        //msg.focus();
        ws=new WebSocket('ws://'+window.location.host);
        ws.onmessage=on_ws_message;
        ws.onopen=on_ws_open;
        ws.onclose=on_ws_close;
        ws.binaryType = "arraybuffer";
        ws.onerror = on_ws_error;

//        if(is_touch_enabled()) {
//console.log("touch enabled");
//          document.getElementById('waterfall').addEventListener("touchstart", onMouseDown, false);
//          document.getElementById('waterfall').addEventListener("touchend", onMouseUp, false);
//          document.getElementById('waterfall').addEventListener("touchmove", onMouseMove, false);
//        } else {
//console.log("touch NOT enabled");
          //document.getElementById('waterfall').addEventListener("click", onClick, false);
          document.getElementById('waterfall').addEventListener("mousedown", onClick, false);
          //document.getElementById('waterfall').addEventListener("mousedown", onMouseDown, false);
          //document.getElementById('waterfall').addEventListener("mouseup", onMouseUp, false);
          //document.getElementById('waterfall').addEventListener("mousemove", onMouseMove, false);
          document.getElementById('waterfall').addEventListener("wheel", onWheel, false);
//        }

          info = document.getElementById('info');
          info.innerHTML = "Samples="+samples.toString()+" Hz/sample="+spanHz.toString();

        player.volume(1.00);
      }

    window.addEventListener('load', init, false);

    var increment=1000;

    function onClick(e) {
      var span=spanHz*samples;
      width=document.getElementById('waterfall').width;
      hzPerPixel=span/width;
      f=Math.round((centerHz-(span/2))+(hzPerPixel*e.pageX));
      f=f-(f%increment);
      document.getElementById("freq").value=f.toString();
      setFrequency();
    }

    var pressed=false;
    var moved=false;
    var startX;
    function onMouseDown(e) {
      moved=false;
      pressed=true;
      startX=e.pageX;
    }
    function onMouseUp(e) {
      if(!moved) {
        width=document.getElementById('waterfall').width;
        hzPerPixel=spanHz/width;
        f=Math.round((centerHz-(spanHz/2))+(hzPerPixel*e.pageX));
        f=f-(f%increment);
        document.getElementById("freq").value=f.toString();
        setFrequency();
      }
      pressed=false;
    }
    function onMouseMove(e) {
      if(pressed) {
        moved=true;
        if(startX<e.pageX) {
          incrementFrequency();
        } else if(e.pageX<startX) {
          decrementFrequency();
        }
        startX=e.pageX;
      }
    }



    function onWheel(e) {
      event.preventDefault();
      if(e.deltaY<0) {
        //scroll up
        incrementFrequency();
      } else {
        // scroll down
        decrementFrequency();
      }
    }

    
    var counter;

    function step_changed(value) {
      increment = parseInt(value);
    }

    function incrementFrequency()
    {
        var value = parseInt(document.getElementById('freq').value, 10);
        value = isNaN(value) ? 0 : value;
        value = value + increment;
        document.getElementById('freq').value = value;
        ws.send("F:"+document.getElementById('freq').value);
        //document.getElementById("freq").value=value.toString();
        //band.value=document.getElementById('msg').value;
        spectrum.setFrequency(parseInt(document.getElementById('freq').value));
    }
    function decrementFrequency()
    {
        var value = parseInt(document.getElementById('freq').value, 10);
        value = isNaN(value) ? 0 : value;
        value = value - increment;
        document.getElementById('freq').value = value;
        ws.send("F:"+document.getElementById('freq').value);
        //document.getElementById("freq").value=value.toString();
        //band.value=document.getElementById('msg').value;
        spectrum.setFrequency(parseInt(document.getElementById('freq').value));
    }
    function startIncrement() {
        incrementFrequency();
        counter=setInterval(incrementFrequency,200);
    }
    function stopIncrement() {
        clearInterval(counter);
    }
    function startDecrement() {
        decrementFrequency();
        counter=setInterval(decrementFrequency,200);
    }
    function stopDecrement() {
        clearInterval(counter);
    }
    function setFrequency()
    {
        ws.send("F:"+document.getElementById('freq').value);
        //document.getElementById("freq").value=document.getElementById('msg').value;
        //band.value=document.getElementById('msg').value;
        spectrum.setFrequency(parseInt(document.getElementById('freq').value));
    }
    function setBand(freq) {
        f=parseInt(freq);
        document.getElementById('freq').value = freq;
        //ws.send("B:"+freq);
        ws.send("F:"+freq);
        spectrum.setFrequency(f);
    }
    function setMode(selected_mode) {
        ws.send("M:"+selected_mode);
    }
    function selectMode(mode) {
        let element = document.getElementById('mode');
        element.value = mode;
        ws.send("M:"+mode);
    }

    function zoomin() {
      ws.send("Z:+:"+document.getElementById('freq').value);
    }
    function zoomout() {
      ws.send("Z:-:"+document.getElementById('freq').value);
    }
    function zoomcenter() {
      ws.send("Z:c");
    }
    function zoomTo(w) {
      ws.send("Z:"+w.toString());
    }
    function audioReporter(stats) {
    }

    async function audio_start_stop()
    {
        var btn = document.getElementById("audio_button");
        if(btn.value==="START") {
          btn.value = "STOP";
          btn.innerHTML = "Stop Audio";
          ws.send("A:START:"+ssrc.toString());
          player.resume();
        } else {
          btn.value = "START";
          btn.innerHTML = "Start Audio";
          ws.send("A:STOP:"+ssrc.toString());
        }
    }

