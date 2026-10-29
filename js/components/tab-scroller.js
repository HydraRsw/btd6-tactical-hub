// The tab strip scrolls sideways on narrow screens. Arrows appear on whichever
// side has more tabs, the mouse wheel scrolls it, and the active tab is kept in view.

export function tabScroller() {
  return {
    canLeft: false,
    canRight: false,

    init() {
      this.$nextTick(() => {
        this.update();
        this.showActive();
      });
      this.$watch('$store.hub.activeTab', () => this.$nextTick(() => this.showActive()));
      // Tab labels change width when the Spanish text swaps in.
      new ResizeObserver(() => this.update()).observe(this.$refs.strip);
    },

    update() {
      const strip = this.$refs.strip;
      this.canLeft = strip.scrollLeft > 4;
      this.canRight = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4;
    },

    scrollBy(direction) {
      const strip = this.$refs.strip;
      strip.scrollBy({ left: direction * strip.clientWidth * 0.7, behavior: 'smooth' });
    },

    /** A vertical wheel over the strip scrolls it sideways (only when there's somewhere to go). */
    wheel(event) {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if ((event.deltaY < 0 && !this.canLeft) || (event.deltaY > 0 && !this.canRight)) return;
      event.preventDefault();
      this.$refs.strip.scrollLeft += event.deltaY;
    },

    showActive() {
      const active = this.$refs.strip.querySelector('.tab--active');
      if (!active) return;
      const strip = this.$refs.strip;
      const left = active.offsetLeft - strip.offsetLeft;
      if (left < strip.scrollLeft + 40 || left + active.offsetWidth > strip.scrollLeft + strip.clientWidth - 40) {
        strip.scrollTo({ left: left - strip.clientWidth / 2 + active.offsetWidth / 2, behavior: 'smooth' });
      }
    },
  };
}
