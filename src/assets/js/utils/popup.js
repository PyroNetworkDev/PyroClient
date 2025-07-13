/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { ipcRenderer } = require('electron');
import { localization } from '../utils.js'

export default class popup {
    constructor() {
        this.popup = document.querySelector('.popup');
        this.popupTitle = document.querySelector('.popup-title');
        this.popupContent = document.querySelector('.popup-content');
        this.popupOptions = document.querySelector('.popup-options');
        this.popupButton = document.querySelector('.popup-button');
        this.okButton = document.getElementById('okButton');
        this.cancelButton = document.getElementById('cancelButton');
        this.acceptButton = document.getElementById('acceptButton');
    }

    openPopup(info) {
        this.popup.style.display = 'flex';
        if (info.background == false) this.popup.style.background = 'none';
        else this.popup.style.background = '#000000b3'
        this.popupTitle.innerHTML = info.title;
        this.popupContent.style.color = info.color ? info.color : '#e21212';
        this.popupContent.innerHTML = info.content;

        if (info.options) {
            this.popupOptions.style.display = 'flex';
            this.okButton.style.display = 'flex';
            this.cancelButton.style.display = 'none';
            this.acceptButton.style.display = 'none';
        }

        if (this.popupOptions.style.display !== 'none') {
            this.okButton.addEventListener('click', () => {
                if (info.exit) return ipcRenderer.send('main-window-close');
                try {
                    info.callback();
                } catch (error) {}
                this.closePopup();
            })
        }
    }

    openDialog(info) {
        this.popup.style.display = 'flex';
        if (info.background == false) this.popup.style.background = 'none';
        else this.popup.style.background = '#000000b3'
        this.popupTitle.innerHTML = info.title;
        this.popupContent.style.color = info.color ? info.color : '#e21212';
        this.popupContent.innerHTML = info.content;

        if (info.options) {
            this.popupOptions.style.display = 'flex';
            this.okButton.style.display = 'none';
            this.cancelButton.style.display = 'flex';
            this.acceptButton.style.display = 'flex';
            this.cancelButton.style.order = '2';
            this.acceptButton.style.order = '1';
        }
        const cancelButton = document.getElementById('cancelButton');
        // If cancelText is not provided, use a default value
        cancelButton.innerHTML = info.cancelText || localization.t('buttons.cancel');
        cancelButton.addEventListener('click', () => {
            this.closePopup();
            info.callback('cancel');
        });
        this.popupOptions.appendChild(cancelButton);

        const acceptButton = document.getElementById('acceptButton');
        acceptButton.innerHTML = info.acceptText || localization.t('buttons.accept');
        acceptButton.addEventListener('click', () => {
            this.closePopup();
            info.callback('accept');
        });
        this.popupOptions.appendChild(acceptButton);
    }

    closePopup() {
        this.popup.style.display = 'none';
        this.popupTitle.innerHTML = '';
        this.popupContent.innerHTML = '';
        this.popupOptions.style.display = 'none';
    }
}