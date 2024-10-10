function PCMPlayer(option) {
    this.init(option);
}

PCMPlayer.prototype.init = function(option) {
    var defaults = {
        encoding: '16bitInt',
        channels: 1,
        sampleRate: 48000,
        flushingTime: 500
    };
    this.option = Object.assign({}, defaults, option);
    this.grabbing = null;
    this.samples = new Float32Array();
    this.flush = this.flush.bind(this);
    this.interval = setInterval(this.flush, this.option.flushingTime);
    this.maxValue = this.getMaxValue();
    this.typedArray = this.getTypedArray();
    this.createContext();
};

PCMPlayer.prototype.getMaxValue = function () {
    var encodings = {
        '8bitInt': 128,
        '16bitInt': 32768,
        '32bitInt': 2147483648,
        '32bitFloat': 1
    }

    return encodings[this.option.encoding] ? encodings[this.option.encoding] : encodings['16bitInt'];
};

PCMPlayer.prototype.getTypedArray = function () {
    var typedArrays = {
        '8bitInt': Int8Array,
        '16bitInt': Int16Array,
        '32bitInt': Int32Array,
        '32bitFloat': Float32Array
    }

    return typedArrays[this.option.encoding] ? typedArrays[this.option.encoding] : typedArrays['16bitInt'];
};

PCMPlayer.prototype.createContext = function() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // context needs to be resumed on iOS and Safari (or it will stay in "suspended" state)
    this.audioCtx.resume();
    //this.audioCtx.onstatechange = () => console.log(this.audioCtx.state);   // if you want to see "Running" state in console and be happy about it
    
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = 1;
    this.gainNode.connect(this.audioCtx.destination);
    this.startTime = this.audioCtx.currentTime;
};

PCMPlayer.prototype.resume = function() {
    this.audioCtx.resume();
}

PCMPlayer.prototype.isTypedArray = function(data) {
    return (data.byteLength && data.buffer && data.buffer.constructor == ArrayBuffer);
};

PCMPlayer.prototype.feed = function(data) {
    if (!this.isTypedArray(data)) {
        console.log("feed: not typed array");
        return;
    }
    var fdata = this.getFormatedValue(data);
    if (this.grabbing) {
	this.grabbing(new this.typedArray(data.buffer));
    }
    var tmp = new Float32Array(this.samples.length + fdata.length);
    tmp.set(this.samples, 0);
    tmp.set(fdata, this.samples.length);
    this.samples = tmp;
    this.audioCtx.resume();
};

PCMPlayer.prototype.startGrabbing = function(callback) {
    this.grabbing = callback;
};

PCMPlayer.prototype.stopGrabbing = function(callback) {
    this.grabbing = null;
};

PCMPlayer.prototype.getFormatedValue = function(data) {
    var ndata = new this.typedArray(data.buffer),
        float32 = new Float32Array(ndata.length),
        i;
    for (i = 0; i < ndata.length; i++) {
        float32[i] = ndata[i] / this.maxValue;
    }
    return float32;
};

PCMPlayer.prototype.volume = function(volume) {
    this.gainNode.gain.value = volume;
};

PCMPlayer.prototype.destroy = function() {
    if (this.interval) {
        clearInterval(this.interval);
    }
    this.samples = null;
    this.audioCtx.close();
    this.audioCtx = null;
};

PCMPlayer.prototype.flush = function() {
    if (!this.samples.length) return;
    var bufferSource = this.audioCtx.createBufferSource(),
        length = this.samples.length / this.option.channels,
        audioBuffer = this.audioCtx.createBuffer(this.option.channels, length, this.option.sampleRate),
        audioData,
        channel,
        offset,
        i,
        decrement;

    for (channel = 0; channel < this.option.channels; channel++) {
        audioData = audioBuffer.getChannelData(channel);
        offset = channel;
        decrement = 50;
        for (i = 0; i < length; i++) {
            audioData[i] = this.samples[offset];
            /* fadein */
// just make this a simple copy to eliminate thumping - KA9Q 7 March 2024
//            if (i < 50) {
//                audioData[i] =  (audioData[i] * i) / 50;
//            }
            /* fadeout*/
//            if (i >= (length - 51)) {
//                audioData[i] =  (audioData[i] * decrement--) / 50;
//            }
            offset += this.option.channels;
        }
    }
    
    if (this.startTime >= this.audioCtx.currentTime + 1) {
        // Throw away audio data
	console.log("Start time too far in the future -- discarding audio -- offset: " + (this.startTime - this.audioCtx.currentTime));
        this.samples = new Float32Array();
	return;
    }
    if (this.startTime < this.audioCtx.currentTime &&
	this.startTime > this.audioCtx.currentTime - 0.1) {
	this.startTime = this.audioCtx.currentTime;
    }
    if (this.startTime >= this.audioCtx.currentTime) {
	//console.log('start vs current '+this.startTime+' vs '+this.audioCtx.currentTime+' duration: '+audioBuffer.duration + ' offset: ' + (this.startTime - this.audioCtx.currentTime) + ' outputTimestamp ' + this.audioCtx.getOutputTimestamp());
	bufferSource.buffer = audioBuffer;
	bufferSource.connect(this.gainNode);
	bufferSource.start(this.startTime);
        this.startTime += audioBuffer.duration;
    } else {
	console.log("Start time too far in the past -- discarding audio -- offset: " + (this.audioCtx.currentTime - this.startTime));
	if (this.startTime < this.audioCtx.currentTime ) {
	    this.startTime = this.audioCtx.currentTime;
	} 
        this.startTime += audioBuffer.duration;
    }
    this.samples = new Float32Array();
};
