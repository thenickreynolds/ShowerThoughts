var appstore = chrome.storage.sync;
var globalData = {};

$('document').ready(function(){
    refresh(false);

    $('#refresh').click(function () { refresh(true); });

	init_todo();
	init_share();
});

var refresh = function(force) {
	$('#loading').show();
	$('.content').hide();

    appstore.get(['date', 'shower', 'earth'], function(data) {
    	var today = (new Date()).toDateString();

    	if (!force && isValidData(data) && data.date == today) {
    		var earth = data.earth;
    		setEarthPorn(earth.author, earth.postUrl, earth.imageUrl);

    		var shower = data.shower;
    		setShowerThought(shower.author, shower.quote, shower.quoteUrl);

    	} else {
    		appstore.set({date: today}, null);
    		loadFromNetwork();
    	}
    });
};

var isValidData = function (data) {
	return data !== null && data.shower !== null && data.earth !== null && data.date !== null;
};

var loadFromNetwork = function () {
	$.getJSON("https://www.reddit.com/r/earthporn/top.json?sort=top&t=month&limit=20",function(json){
		var rand=Math.floor(Math.random() * 20);
		var post=json.data.children[rand].data;
		var url=post.url;
		var author=post.author;
		var title=post.title.toLowerCase();
		var postUrl="http://www.reddit.com"+post.permalink;

		var imageUrl=tryConvertUrl(url);

		appstore.set({earth: {author: author, postUrl: postUrl, imageUrl: imageUrl}}, null);
		setEarthPorn(author, postUrl, imageUrl);
	});
	$.getJSON("https://www.reddit.com/r/showerthoughts/top.json?sort=top&t=month&limit=20",function(json) {
		var rand=Math.floor(Math.random() * 20);
		var post=json.data.children[rand].data;
		var quote=post.title;
		var author=post.author;
		var quoteUrl="http://www.reddit.com"+post.permalink;

		appstore.set({shower: {author: author, quote: quote, quoteUrl: quoteUrl}}, null);
		setShowerThought(author, quote, quoteUrl);
	});
};

var setEarthPorn = function (author, postUrl, imageUrl) {
	$('#picby').html("<a href='"+postUrl+"' target='_blank'>photo by u/"+author+"</a>");
	$('<img/>').attr('src', imageUrl).load(function() {
		$(this).remove(); // prevent memory leaks
		$('#loading').fadeOut("fast");

		$('#image').css('background-image', "url("+imageUrl+")");
		$('.content').fadeIn("slow");
	});

	globalData.imageAuthor = author;
	globalData.imageUrl = imageUrl;

	prepareShare();
};

var setShowerThought = function (author, quote, quoteUrl) {
	$('#quote').html("\""+quote+"\"");
	$('#author').html(" - <a href='"+quoteUrl+"' target='_blank'>u/"+author+"</a>");

	globalData.quoteText = quote;
	globalData.quoteAuthor = author;

	prepareShare();
};

var tryConvertUrl = function (url) {
	if (url.indexOf('imgur.com') > 0 || url.indexOf('/gallery/') > 0) {
		if (url.indexOf('gifv') >= 0) {
			if (url.indexOf('i.') === 0) {
				url = url.replace('imgur.com', 'i.imgur.com');
			}
			return url.replace('.gifv', '.gif');
		}
		if (url.indexOf('/a/') > 0 || url.indexOf('/gallery/') > 0) {
			return '';
		}
		return url.replace(/r\/[^ \/]+\/(\w+)/, '$1') + '.jpg';
	}
	return url;
};

var init_todo = function() {
  $('#todo_toggle').click(function() { toggle_todo(false); });

  appstore.get(['todo_enabled'], function(data) {
    if (data !== null && data.todo_enabled) {
      toggle_todo(true);
    }
  });
};

var toggle_todo = function(force_on) {
  var frame = $('#todo_iframe');
  var hidden = frame.css("display") === "none";

  var enable = hidden || force_on;
  if (enable && frame.attr("src") == "about:blank") {
    frame.attr("src", "https://chrome.todoist.com/?mini=1");
  }
  frame.css("display", enable ? "inline" : "none");
  appstore.set({todo_enabled: enable}, null);
};

var init_share = function() {
	$('#share_frame').click(function() { share_click(); });
};

var prepareShare = function() {
	if (!(globalData.quoteText && globalData.imageUrl)) {
		return;
	}

	var canvas = $('#screenshot_canvas')[0];
	var ctx = canvas.getContext("2d", {alpha: false});

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	var img = new Image;
	img.onload = function(){
		drawImageProp(ctx, img, 0, 0, canvas.width, canvas.height, 0, 0);
		var fontSize = 50;
		ctx.font = `${fontSize}px BeautifulFont`;
		ctx.shadowColor = "black";
		ctx.shadowOffsetX = 5;
		ctx.shadowOffsetY = 5;
		ctx.shadowBlur = 20;
		ctx.fillStyle = "white";
		ctx.textAlign = "center";

		var lines = breakCanvasLines(ctx, `"${globalData.quoteText}"`, 1400);
		var center = canvas.height / 2;
		var lineHeight = fontSize * 1.1;
		var startHeight = center - ((lines.length * lineHeight) / 2) + (lineHeight / 2);
		for (var i = 0; i < lines.length; i++) {
			ctx.fillText(`${lines[i]}`, canvas.width/2, startHeight + (i * lineHeight));
		}

		ctx.font = `${fontSize/2}px BeautifulFont`;
		ctx.fillText(`- ${globalData.quoteAuthor}`, canvas.width - canvas.width/4, startHeight + (lines.length * lineHeight));

		ctx.font = `${fontSize/3}px BeautifulFont`;
		ctx.fillText(`photo by ${globalData.imageAuthor}`, canvas.width/2, canvas.height - (lineHeight / 2));
	};
	img.src = globalData.imageUrl;
}

var share_click = function() {
	downloadCanvas($('#screenshot_canvas')[0], "ShowerThoughts NewTab.png");
};

function dataURLtoBlob(dataurl) {
	var arr = dataurl.split(',');
	var mime = arr[0].match(/:(.*?);/)[1];
	var bstr = atob(arr[1]);
	var n = bstr.length;
	var u8arr = new Uint8Array(n);

    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
	}

    return new Blob([u8arr], {type:mime});
}

var downloadCanvas = function(canvas, filename){
	var imgData = canvas.toDataURL({format: 'png', multiplier: 4});
	var blob = dataURLtoBlob(imgData);
	var objurl = URL.createObjectURL(blob);

	var link = document.createElement("a");
	link.download = filename;
	link.href = objurl;
	link.click();
}

function breakCanvasLines(ctx, text, maxWidth) {
    var words = text.split(" ");
    var lines = [];
    var currentLine = words[0];

    for (var i = 1; i < words.length; i++) {
        var word = words[i];
        var width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

/**
 * By Ken Fyrstenberg Nilsen
 *
 * drawImageProp(context, image [, x, y, width, height [,offsetX, offsetY]])
 *
 * If image and context are only arguments rectangle will equal canvas
*/
function drawImageProp(ctx, img, x, y, w, h, offsetX, offsetY) {

    if (arguments.length === 2) {
        x = y = 0;
        w = ctx.canvas.width;
        h = ctx.canvas.height;
    }

    // default offset is center
    offsetX = typeof offsetX === "number" ? offsetX : 0.5;
    offsetY = typeof offsetY === "number" ? offsetY : 0.5;

    // keep bounds [0.0, 1.0]
    if (offsetX < 0) offsetX = 0;
    if (offsetY < 0) offsetY = 0;
    if (offsetX > 1) offsetX = 1;
    if (offsetY > 1) offsetY = 1;

    var iw = img.width,
        ih = img.height,
        r = Math.min(w / iw, h / ih),
        nw = iw * r,   // new prop. width
        nh = ih * r,   // new prop. height
        cx, cy, cw, ch, ar = 1;

    // decide which gap to fill    
    if (nw < w) ar = w / nw;                             
    if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  // updated
    nw *= ar;
    nh *= ar;

    // calc source rectangle
    cw = iw / (nw / w);
    ch = ih / (nh / h);

    cx = (iw - cw) * offsetX;
    cy = (ih - ch) * offsetY;

    // make sure source rectangle is valid
    if (cx < 0) cx = 0;
    if (cy < 0) cy = 0;
    if (cw > iw) cw = iw;
    if (ch > ih) ch = ih;

    // fill image in dest. rectangle
    ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
}