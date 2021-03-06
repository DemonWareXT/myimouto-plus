/*
 * Creating and deleting IMG nodes seems to cause memory leaks in WebKit, but
 * there are also reports that keeping the same node and replacing src can cause
 * memory leaks (also in WebKit).
 *
 * So we don't have to depend on doing one or the other in other code, abstract
 * this.  Use ImgPool.get() and ImgPool.release() to retrieve a new IMG node and
 * return it.  We can choose here to either keep a pool, to avoid constantly
 * creating new ones, or to throw them away and create new ones, to avoid changing
 * src.
 *
 * This doesn't clear styles or any other properties.  To avoid leaking things from
 * one type of image to another, use separate pools for each.
 */

var ImgPoolHandlerWebKit = Class.create({
  initialize: function()
  {
    this.pool = [];
    this.pool_waiting = [];
    this.blank_image_loaded_event = this.blank_image_loaded_event.bind(this);
  },

  get: function()
  {
    if(this.pool.length == 0)
    {
      // debug("No images in pool; creating blank");
      return $(document.createElement("IMG"));
    }

    // debug("Returning image from pool");
    return this.pool.pop();
  },

  release: function(img)
  {
    /*
     * Replace the image with a blank, so when it's reused it doesn't show the previously-
     * loaded image until the new one is available.  Don't reuse the image until the blank
     * image is loaded.
     *
     * This also encourages the browser to abort any running download, so if we have a large
     * PNG downloading that we've cancelled it won't continue and download the whole thing.
     * Note that Firefox will stop a download if we do this, but not if we only remove an
     * image from the document.
     */
    img.observe("load", this.blank_image_loaded_event);
    this.pool_waiting.push(img);
    img.src = "/images/blank.png";
  },

  blank_image_loaded_event: function(event)
  {
    var img = event.target;
    img.stopObserving("load", this.blank_image_loaded_event);
    this.pool_waiting = this.pool_waiting.without(img);
    this.pool.push(img);
  }
});

var ImgPoolHandlerDummy = Class.create({
  get: function()
  {
    return $(document.createElement("IMG"));
  },

  release: function(img)
  {
    img.src = "/images/blank.png";
  }
});

/* Create an image pool handler.  If the URL hash value "image-pools" is specified,
 * force image pools on or off for debugging; otherwise enable them only when needed. */
var ImgPoolHandler = function()
{
  var use_image_pools = Prototype.Browser.WebKit;
  var hash_value = UrlHash.get("image-pools");
  if(hash_value != null)
    use_image_pools = (hash_value != "0");

  if(use_image_pools)
    return new ImgPoolHandlerWebKit(arguments);
  else
    return new ImgPoolHandlerDummy(arguments);
}

