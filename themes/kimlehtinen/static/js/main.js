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
document.addEventListener("DOMContentLoaded", function() {
let slideshows = document.querySelectorAll(".img-slideshow-gallery-container");

slideshows.forEach((slideshow, index) => {
  let imgshGaIndex = 1;
  imgshGaShowSlides(slideshow, imgshGaIndex);

  slideshow.querySelector(".img-slideshow-gallery-prev").addEventListener("click", function() {
    plusSlides(slideshow, -1);
  });

  slideshow.querySelector(".img-slideshow-gallery-next").addEventListener("click", function() {
    plusSlides(slideshow, 1);
  });

  let dots = slideshow.querySelectorAll(".img-slideshow-gallery-demo");
  dots.forEach((dot, dotIndex) => {
    dot.addEventListener("click", function() {
      currentSlide(slideshow, dotIndex + 1);
    });
  });
});

function plusSlides(slideshow, n) {
  let imgshGaIndex = parseInt(slideshow.getAttribute("data-index")) || 1;
  imgshGaIndex += n;
  if (imgshGaIndex > slideshow.getElementsByClassName("img-slideshow-gallery-myslides").length) {
    imgshGaIndex = 1;
  }
  if (imgshGaIndex < 1) {
    imgshGaIndex = slideshow.getElementsByClassName("img-slideshow-gallery-myslides").length;
  }
  slideshow.setAttribute("data-index", imgshGaIndex);
  imgshGaShowSlides(slideshow, imgshGaIndex);
}

function currentSlide(slideshow, n) {
  slideshow.setAttribute("data-index", n);
  imgshGaShowSlides(slideshow, n);
}

function imgshGaShowSlides(slideshow, n) {
  let i;
  let slides = slideshow.getElementsByClassName("img-slideshow-gallery-myslides");
  let dots = slideshow.getElementsByClassName("img-slideshow-gallery-demo");
  let captionText = slideshow.querySelector(".img-slideshow-gallery-caption");
  if (n > slides.length) { n = 1 }
  if (n < 1) { n = slides.length }
  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }
  slides[n - 1].style.display = "block";
  dots[n - 1].className += " active";
  captionText.innerHTML = dots[n - 1].alt;
}
});
