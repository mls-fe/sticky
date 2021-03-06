/**
 * Sticky:
 *      sticky 对 table 元素无效
 *      top 在默认情况下不生效
 *      left 生效
 *      sticky 元素在自身 rect 与包含块 rect 交集组成的限制区域内活动
 *
 * TODO:
 *      bottom & right
 *      handle negative value
 */

;(function ( win, $ ) {
    var $win           = $( win ),
        globalSticky   = [],
        defaultConfig  = {
            top : 0,
            left: 0
        },
        replicateAttrs = [ 'margin', 'padding', 'width', 'height', 'float', 'display', 'position', 'left' ],
        prevScrollTop  = 0,
        prevScrollLeft = 0,

        VERTICAL       = 'vertical',
        HORIZONTAL     = 'horizontal',
        SCROLL_EVENT   = 'scroll.sticky',
        INTERVAL_VALUE = 2000,
        stickyStyleName

    /**
     * @FIXME: Chrome 目前对 sticky 的实现是错误的
     * https://www.chromestatus.com/feature/6190250464378880
     */
    function isChrome() {
        return !!win.chrome || navigator.userAgent.indexOf( 'Chrome' ) != -1
    }

    function isSupportSticky() {
        if ( isChrome() ) {
            return false
        }

        var doom = document.createElement( 'div' );

        [ '', '-webkit-', '-moz-', '-ms-', '-o-' ].forEach( function ( v ) {
            doom.style.position = v + 'sticky'
        } )

        return ( stickyStyleName = doom.style.position ).indexOf( 'sticky' ) != -1
    }

    function observeSize( el, callback ) {
        var observer

        if ( typeof win.MutationObserver == 'undefined' ) {
            var intervalId = setInterval( callback, INTERVAL_VALUE )

            observer = {
                disconnect: function () {
                    clearTimeout( intervalId )
                }
            }
        } else {
            observer = new MutationObserver( callback )
            observer.observe( el, {
                childList: true,
                subtree  : true
            } )
        }

        return observer
    }

    function parseMarginOrPadding( val ) {
        var arr = val.split( ' ' ),
            len = 4,
            tmp = [],
            v

        if ( !val ) {
            arr = tmp = [ 0, 0, 0, 0 ]
        } else {
            while ( len-- ) {
                tmp[ len ] = parseInt( arr[ len ] )
            }
        }

        switch ( arr.length ) {
            case 1:
                v = tmp[ 0 ]
                return {
                    top   : v,
                    left  : v,
                    right : v,
                    bottom: v
                }
                break

            case 2:
                return {
                    top   : tmp[ 0 ],
                    left  : tmp[ 1 ],
                    right : tmp[ 1 ],
                    bottom: tmp[ 0 ]
                }
                break

            case 3:
                return {
                    top   : tmp[ 0 ],
                    left  : tmp[ 1 ],
                    right : tmp[ 1 ],
                    bottom: tmp[ 2 ]
                }
                break

            case 4:
                return {
                    top   : tmp[ 0 ],
                    right : tmp[ 1 ],
                    bottom: tmp[ 2 ],
                    left  : tmp[ 3 ]
                }
        }
    }

    //TODO: too simple
    function parseCSSVal( val ) {
        if ( val == 'auto' ) {
            return 0
        } else {
            return parseInt( val )
        }
    }

    function Sticky( el, config ) {
        this.config = config
        this.$el    = $( el )
        this.rect   = {}
        this.state  = {
            hasHolder            : false,
            isFixed              : false,
            isVerticalFixed      : false,
            isHorizontalFixed    : false,
            isQualified          : true,
            isVerticalQualified  : true,
            isHorizontalQualified: true
        }

        this.init()
    }

    Sticky.prototype = {
        constructor: Sticky,

        init: function () {
            var that = this

            if ( !isSupportSticky() ) {
                this
                    .isQualified()
                    .prepareCompute()
                    .generateHolder()
                    .computePosition()

                //@TODO optimise
                this.observeHandler = observeSize( this.$parent[ 0 ], function () {
                    //differ parentBox's height
                    that.rect.offset.bottom += that.computeBoxModel( that.$parent ).height - that.pBox.height
                } )
            } else {
                var config             = this.config
                config.position        = stickyStyleName
                this.state.isQualified = false
                this.$el.css( config )
            }
        },

        isQualified: function () {
            var state  = this.state,
                el     = this.$el[ 0 ],
                styles = win.getComputedStyle( el )

            if ( el.tagName.toLowerCase() == 'table' ) {
                state.isQualified = false
                return this
            }

            if ( styles.top == 'auto' && styles.bottom == 'auto' ) {
                state.isVerticalQualified = false
            }

            if ( styles.left == 'auto' && styles.right == 'auto' ) {
                state.isHorizontalQualified = false
            }

            state.isQualified = state.isHorizontalQualified || state.isVerticalQualified

            return this
        },

        prepareCompute: function () {
            var $el = this.$el,
                $parent

            this.$parent = $parent = $el.parent()
            this.elBox = this.computeBoxModel( $el )
            this.pBox  = this.computeBoxModel( $parent )

            return this
        },

        generateHolder: function () {
            var config    = this.config,
                state     = this.state,
                $el       = this.$el,
                pBox      = this.pBox,
                holderCSS = '',
                $placeholder, elStyle

            if ( !state.hasHolder ) {
                $placeholder    = $( '<x-faketag>' )
                state.hasHolder = true

                $el.css( $.extend( {}, config, {
                    position: 'relative',
                    left    : ( config.left ? ( config.left - pBox.padding.left ) : 0 ) + 'px'
                } ) )

                elStyle = getComputedStyle( $el[ 0 ] )
                for ( var key in config ) {
                    if ( replicateAttrs.indexOf( key ) == -1 ) {
                        holderCSS += key + ':' + elStyle[ key ] + ';'
                    }
                }

                this.holderCSS = holderCSS + replicateAttrs.map( function ( v ) {
                        return v + ':' + elStyle[ v ]
                    } ).join( ';' )

                $el.after( $placeholder )
                this.$placeholder = $placeholder
            } else {
                $placeholder = this.$placeholder
            }

            $placeholder[ 0 ].style.cssText = this.holderCSS + ';top:0;display:none;'

            return this
        },

        computeBoxModel: function ( el ) {
            var offset = el.offset()

            return {
                margin : parseMarginOrPadding( el.css( 'margin' ) ),
                padding: parseMarginOrPadding( el.css( 'padding' ) ),
                width  : offset.width,
                height : offset.height
            }
        },

        //TODO
        computePosition: function () {
            var config   = this.config,
                $el      = this.$el,
                rect     = this.rect,
                pOffset  = this.$parent.offset(),
                elOffset = $el.offset(),
                pBox     = this.pBox,
                elBox    = this.elBox,
                top      = elOffset.top,
                left     = elOffset.left,
                pTop     = pOffset.top - pBox.padding.top - pBox.margin.top,
                pLeft    = pOffset.left - pBox.padding.left - pBox.margin.left,
                bottom, right

            //TODO
            top    = pTop > top ? pTop : top
            left   = pLeft > left ? pLeft : left
            bottom = top + pBox.height - pBox.padding.top - pBox.padding.bottom - elBox.margin.top - elBox.margin.bottom - elBox.height - config.top
            right  = left + pBox.width - pBox.padding.left - pBox.padding.right - elBox.margin.left - elBox.margin.right - elBox.width - config.left

            config.top  = config.top ? config.top : 0
            config.left = config.left ? config.left : 0

            rect.constraint = config

            if ( right < 0 ) {
                left += right
                config.left += right
                right = 0
            }

            if ( bottom < 0 ) {
                top += bottom
                config.top += bottom
                bottom = 0
            }

            this.rect.offset = {
                top   : top,
                left  : left,
                bottom: bottom,
                right : right
            }

            //TODO
            config.bottom = this.rect.offset.bottom - top
            config.right  = this.rect.offset.right - left

            if ( config.bottom < 0 ) {
                config.bottom = 0
            }

            if ( config.right < 0 ) {
                config.right = 0
            }

            return this
        },

        check: function ( scrollTop, scrollLeft, isVertical ) {
            var state          = this.state,
                rect           = this.rect,
                offsetRect     = rect.offset,
                constraintRect = rect.constraint,
                difference

            if ( isVertical && state.isVerticalQualified ) {
                difference = offsetRect.top - scrollTop
                //TODO
                if ( difference < constraintRect.top && scrollTop < offsetRect.bottom ) {
                    this.fixed( VERTICAL, scrollLeft )
                } else {
                    this.restore( VERTICAL, scrollTop )
                }
            }

            if ( !isVertical && state.isHorizontalQualified ) {
                difference = offsetRect.left - scrollLeft
                //console.log( difference, constraintRect.left )
                //TODO
                if ( difference < constraintRect.left && scrollLeft < offsetRect.right ) {
                    this.fixed( HORIZONTAL, scrollTop )
                } else {
                    this.restore( HORIZONTAL, scrollLeft )
                }
            }
        },

        fixed: function ( dir, scrollVal ) {
            //console.log( 'fixed', dir, scrollVal, scrollTop )
            var $el            = this.$el,
                elBox          = this.elBox,
                elPadding      = elBox.padding,
                state          = this.state,
                rect           = this.rect,
                constraintRect = rect.constraint,
                offsetRect     = rect.offset,
                difference

            //TODO
            if ( !state.isFixed ) {
                state.isFixed = true
                $el.css( {
                    position: 'fixed',
                    //TODO
                    margin  : 0,
                    top     : constraintRect.top,
                    width   : elBox.width - elPadding.left - elPadding.right,
                    height  : elBox.height - elPadding.top - elPadding.bottom
                } )
            }

            if ( dir == VERTICAL ) {
                state.isVerticalFixed = true
                $el.css( 'top', constraintRect.top )

                if ( !state.isHorizontalFixed ) {
                    difference = offsetRect.left - scrollVal
                    $el.css( 'left', difference )
                }
            } else {
                state.isHorizontalFixed = true
                $el.css( 'left', constraintRect.left )

                if ( !state.isVerticalFixed ) {
                    difference = offsetRect.top - scrollVal
                    $el.css( 'top', difference )
                }
            }

            this.$placeholder.css( {
                visibility: 'visible',
                display   : 'block'
            } )
        },

        restore: function ( dir, scrollVal ) {
            var $el            = this.$el,
                state          = this.state,
                rect           = this.rect,
                offsetRect     = rect.offset,
                constraintRect = rect.constraint,
                val, difference

            if ( state.isFixed ) {
                //TODO
                if ( dir == VERTICAL ) {
                    val = offsetRect.bottom
                    //TODO: optimise
                    if ( scrollVal >= val ) {
                        $el.css( 'top', constraintRect.top - scrollVal + val )
                        state.isVerticalFixed = true
                    } else if ( state.isFixed ) {
                        difference = offsetRect.top - scrollVal

                        if ( difference > constraintRect.top ) {
                            $el.css( 'top', difference )
                            state.isVerticalFixed = false
                        }
                    }
                } else {
                    val = offsetRect.right
                    if ( scrollVal >= val ) {
                        $el.css( 'left', constraintRect.left - scrollVal + val )
                        state.isHorizontalFixed = true
                    } else if ( state.isFixed ) {
                        difference = offsetRect.left - scrollVal

                        if ( difference > constraintRect.left ) {
                            $el.css( 'left', difference )
                            state.isHorizontalFixed = false
                        }
                    }
                }
            }

            //TODO
            if ( !state.isVerticalFixed && !state.isHorizontalFixed ) {
                state.isFixed          = false
                $el[ 0 ].style.cssText = this.holderCSS
                this.$placeholder.hide()
            }
        },

        destroy: function () {
            globalSticky.splice( globalSticky.indexOf( this ), 1 )
            this.observeHandler && this.observeHandler.disconnect()
        }
    }

    $.fn.sticky = function ( config ) {
        this.each( function () {
            var sticky = new Sticky( this, $.extend( true, {}, defaultConfig, config ) )
            sticky.state.isQualified && globalSticky.push( sticky )
        } )

        $win.triggerHandler( SCROLL_EVENT, { isForced: true } )

        return this
    }

    function handleScroll( e, data ) {
        var scrollTop  = $win.scrollTop(),
            scrollLeft = $win.scrollLeft(),
            isVertical

        if ( data && data.isForced ) {
            prevScrollLeft = prevScrollTop = 0
        }

        if ( scrollLeft == prevScrollLeft ) {
            isVertical = true
        }

        if ( scrollTop == prevScrollTop ) {
            isVertical = false
        }

        prevScrollTop  = scrollTop
        prevScrollLeft = scrollLeft

        globalSticky.forEach( function ( v ) {
            v.check( scrollTop, scrollLeft, isVertical )
        } )
    }

    $win.on( SCROLL_EVENT, handleScroll )

}( window, $ ))
