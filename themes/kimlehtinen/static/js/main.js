function onNavbarHamburgerMenuClick() {
    var x = document.getElementById("myTopnav");
    if (x.className === "topnav") {
      x.className += " responsive";
    } else {
      x.className = "topnav";
    }
}

/**
 * Image Slideshow Gallery
 */
let imgshGaIndex = 1;
imgshGaShowSlides(imgshGaIndex);

function plusSlides(n) {
  imgshGaShowSlides(imgshGaIndex += n);
}

function currentSlide(n) {
  imgshGaShowSlides(imgshGaIndex = n);
}

function imgshGaShowSlides(n) {
  let i;
  let slides = document.getElementsByClassName("img-slideshow-gallery-myslides");
  let dots = document.getElementsByClassName("img-slideshow-gallery-demo");
  let captionText = document.getElementById("img-slideshow-gallery-caption");
  if (n > slides.length) {imgshGaIndex = 1}
  if (n < 1) {imgshGaIndex = slides.length}
  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }
  slides[imgshGaIndex-1].style.display = "block";
  dots[imgshGaIndex-1].className += " active";
  captionText.innerHTML = dots[imgshGaIndex-1].alt;
}
