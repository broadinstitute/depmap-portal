/* eslint-disable */
import * as React from "react";
import "../styles/accordion.scss";

export enum OpenCloseSymbol {
  PlusMinus = "PlusMinus",
  Caret = "Caret",
  Empty = "Empty",
}
interface Props {
  title: React.ReactNode;
  isOpen?: boolean;
  titleStyle?: React.CSSProperties;
  openCloseSymbol?: OpenCloseSymbol;
  openCloseSymbolStyle?: any;
  disabled?: boolean;
  openingTransition?: string;
  children: React.ReactNode;
}

interface State {
  isOpen: boolean;
  maxHeight: React.CSSProperties["maxHeight"];
  transition: React.CSSProperties["transition"];
  overflowIfOpen: React.CSSProperties["overflow"];
}

export default class Accordion extends React.Component<Props, State> {
  expandableElement: HTMLElement | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      isOpen: props.isOpen ? props.isOpen : false,
      maxHeight: props.isOpen ? "2500px" : 0,
      transition: props.isOpen ? props.openingTransition : "",
      overflowIfOpen: "hidden",
    };
  }

  componentDidUpdate = (prevProps: Props) => {
    const { isOpen } = this.props;

    if (prevProps.isOpen !== isOpen) {
      this.toggle();
    }
  };

  toggle = () => {
    const { disabled } = this.props;
    if (disabled) {
      return;
    }
    const { isOpen } = this.state;
    let newState: any = {};

    if (isOpen) {
      newState = {
        isOpen: false,
        maxHeight: this.expandableElement?.getBoundingClientRect().height,
        transition: null,
        overflowIfOpen: "hidden",
      };
      this.setState(newState);

      setTimeout(
        () =>
          this.setState({
            maxHeight: 0,
            transition: this.props.openingTransition,
          }),
        0
      );
    } else {
      newState = {
        isOpen: true,
        maxHeight: "2500px",
        transition: "max-height 2s ease",
      };
      this.setState(newState);

      setTimeout(() => {
        this.setState({
          overflowIfOpen: "visible", // overflow visible so that dropdown options are shown
        });
      }, 200); // this number is in miliseconds, needs to be after the transition
    }
  };

  render() {
    const {
      children,
      titleStyle,
      title,
      openCloseSymbol,
      openCloseSymbolStyle,
    } = this.props;
    const { transition, maxHeight, isOpen, overflowIfOpen } = this.state;

    const style: React.CSSProperties = {
      transition,
      maxHeight,
      overflow: isOpen ? overflowIfOpen : "hidden",
    };
    let openCloseIconClass;

    const showOpenCloseSymbol = openCloseSymbol != OpenCloseSymbol.Empty;

    if (isOpen && showOpenCloseSymbol) {
      openCloseIconClass =
        openCloseSymbol == OpenCloseSymbol.PlusMinus
          ? "glyphicon glyphicon-minus"
          : "glyphicon glyphicon-chevron-down";
    } else {
      openCloseIconClass =
        openCloseSymbol == OpenCloseSymbol.PlusMinus
          ? "glyphicon glyphicon-plus"
          : "glyphicon glyphicon-chevron-right";
    }
    /*
     * The flex transition is smoother, but the max-height one doesn't require setting height
     * <div style={{display: 'flex', 'flexDirection': 'column', height: '100px'}}>
     * transition: 'flex 0.2s ease-out',
     */

    return (
      <div
        style={{
          margin: 8,
        }}
        className="depmap-accordion"
      >
        <div onClick={this.toggle} className="accordion-header">
          <span style={titleStyle}>
            {showOpenCloseSymbol && (
              <span
                className={openCloseIconClass}
                aria-hidden="true"
                style={openCloseSymbolStyle}
              />
            )}
            <span className="accordion-title">{title}</span>
          </span>
        </div>
        <div
          style={style}
          ref={(element: HTMLDivElement) => {
            this.expandableElement = element;
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  static defaultProps = {
    openCloseSymbol: OpenCloseSymbol.PlusMinus,
    openCloseSymbolStyle: {
      float: "right",
      margin: "0",
      position: "relative",
      top: "50%",
      lineHeight: "unset",
    },
    disabled: false,
    openingTransition: "max-height 0.6s ease",
  };
}
