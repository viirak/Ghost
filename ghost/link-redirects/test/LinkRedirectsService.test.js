const LinkRedirectsService = require('../lib/LinkRedirectsService');
const assert = require('assert');
const sinon = require('sinon');
const crypto = require('crypto');

describe('LinkRedirectsService', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('exported', function () {
        assert.equal(require('../index').LinkRedirectsService, LinkRedirectsService);
    });

    describe('getSlugUrl', function () {
        it('works for first random slug that does not exist', async function () {
            const instance = new LinkRedirectsService({
                linkRedirectRepository: {
                    getByURL: () => Promise.resolve(undefined)
                },
                config: {
                    baseURL: new URL('https://localhost:2368/')
                }
            });
            // stub crypto.randomBytes to return a known value toString
            sinon.stub(crypto, 'randomBytes').returns(Buffer.from('00000000', 'hex'));
            const url = await instance.getSlugUrl();
            assert.equal(url, 'https://localhost:2368/r/00000000');
        });

        it('works when first random slug already exists', async function () {
            const instance = new LinkRedirectsService({
                linkRedirectRepository: {
                    getByURL: (url) => {
                        if (url.toString() === 'https://localhost:2368/r/00000000') {
                            return Promise.resolve({});
                        }
                        return Promise.resolve(undefined);
                    }
                },
                config: {
                    baseURL: new URL('https://localhost:2368/')
                }
            });
            // stub crypto.randomBytes to return 00000000 first and something else
            sinon.stub(crypto, 'randomBytes')
                .onFirstCall().returns(Buffer.from('00000000', 'hex'))
                .onSecondCall().returns(Buffer.from('11111111', 'hex'));
            const url = await instance.getSlugUrl();
            assert.equal(url, 'https://localhost:2368/r/11111111');
        });
    });

    describe('addRedirect', function () {
        it('saves', async function () {
            const linkRedirectRepository = {
                save: sinon.fake()
            };
            const instance = new LinkRedirectsService({
                linkRedirectRepository,
                config: {
                    baseURL: new URL('https://localhost:2368/')
                }
            });
            await instance.addRedirect(new URL('https://localhost:2368/a'), new URL('https://localhost:2368/b'));
            assert.equal(linkRedirectRepository.save.callCount, 1);
            assert.equal(linkRedirectRepository.save.getCall(0).args[0].from.toString(), 'https://localhost:2368/a');
            assert.equal(linkRedirectRepository.save.getCall(0).args[0].to.toString(), 'https://localhost:2368/b');
        });
    });

    describe('handleRequest', function () {
        it('redirects if found', async function () {
            const linkRedirectRepository = {
                getByURL: (url) => {
                    if (url.toString() === 'https://localhost:2368/a') {
                        return Promise.resolve({
                            to: new URL('https://localhost:2368/b')
                        });
                    }
                    return Promise.resolve(undefined);
                }
            };
            const instance = new LinkRedirectsService({
                linkRedirectRepository,
                config: {
                    baseURL: new URL('https://localhost:2368/')
                }
            });
            const req = {
                originalUrl: '/a'
            };
            const res = {
                redirect: sinon.fake()
            };
            await instance.handleRequest(req, res);
            assert.equal(res.redirect.callCount, 1);
            assert.equal(res.redirect.getCall(0).args[0], 'https://localhost:2368/b');
        });

        it('does not redirect if not found', async function () {
            const linkRedirectRepository = {
                getByURL: () => Promise.resolve(undefined)
            };
            const instance = new LinkRedirectsService({
                linkRedirectRepository,
                config: {
                    baseURL: new URL('https://localhost:2368/')
                }
            });
            const req = {
                url: '/a'
            };
            const res = {};
            const next = sinon.fake();
            await instance.handleRequest(req, res, next);
            assert.equal(next.callCount, 1);
        });
    });
});
