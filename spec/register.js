(function (root, factory) {
    define(["mock", "converse-api", "test_utils"], factory);
} (this, function (mock, converse_api, test_utils) {
    var $ = converse_api.env.jQuery;
    var Strophe = converse_api.env.Strophe;
    var $iq = converse_api.env.$iq;

    describe("The Registration Panel", function () {
        afterEach(function () {
            converse_api.user.logout();
            converse_api.listen.not();
            test_utils.clearBrowserStorage();
        });

        it("is not available unless allow_registration=true",  mock.initConverse(function (converse) {
            runs(test_utils.openControlBox);
            waits(50);
            runs(function () {
                var cbview = converse.chatboxviews.get('controlbox');
                expect(cbview.$('#controlbox-tabs li').length).toBe(1);
                expect(cbview.$('#controlbox-tabs li').text().trim()).toBe("Sign in");
            });
        }, { auto_login: false,
              allow_registration: false,
            }));

        it("can be opened by clicking on the registration tab", mock.initConverse(function (converse) {
            var cbview = converse.chatboxviews.get('controlbox');
            runs(test_utils.openControlBox);
            waits(50);
            runs(function () {
                var $tabs = cbview.$('#controlbox-tabs');
                var $panels = cbview.$('.controlbox-panes');
                var $login = $panels.children().first();
                var $registration = $panels.children().last();
                expect($tabs.find('li').first().text()).toBe('Sign in');
                expect($tabs.find('li').last().text()).toBe('Register');

                spyOn(cbview, 'switchTab').andCallThrough();
                cbview.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                $tabs.find('li').last().find('a').click(); // Click the Register tab
                expect($login.is(':visible')).toBe(false);
                expect($registration.is(':visible')).toBe(true);
                expect(cbview.switchTab).toHaveBeenCalled();
            });
        }, { auto_login: false,
              allow_registration: true,
            }));

        it("allows the user to choose an XMPP provider's domain", mock.initConverse(function (converse) {
            var cbview = converse.chatboxviews.get('controlbox');
            var registerview = cbview.registerpanel;
            spyOn(registerview, 'onProviderChosen').andCallThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(converse.connection, 'connect');
            var $tabs = cbview.$('#controlbox-tabs');
            $tabs.find('li').last().find('a').click(); // Click the Register tab
            // Check the form layout
            var $form = cbview.$('#converse-register');
            expect($form.find('input').length).toEqual(2);
            expect($form.find('input').first().attr('name')).toEqual('domain');
            expect($form.find('input').last().attr('type')).toEqual('submit');
            // Check that the input[type=domain] input is required
            $form.find('input[type=submit]').click();
            expect(registerview.onProviderChosen).toHaveBeenCalled();
            expect($form.find('input[name=domain]').hasClass('error')).toBeTruthy();
            // Check that the form is accepted if input[type=domain] has a value
            $form.find('input[name=domain]').val('conversejs.org');
            $form.find('input[type=submit]').click();
            expect(registerview.onProviderChosen).toHaveBeenCalled();
            expect(converse.connection.connect).toHaveBeenCalled();
        }, { auto_login: false,
              allow_registration: true,
            }));

        it("will render a registration form as received from the XMPP provider", mock.initConverse(function (converse) {
            var cbview = converse.chatboxviews.get('controlbox');
            cbview.$('#controlbox-tabs').find('li').last().find('a').click(); // Click the Register tab
            var registerview = converse.chatboxviews.get('controlbox').registerpanel;
            spyOn(registerview, 'onProviderChosen').andCallThrough();
            spyOn(registerview, 'getRegistrationFields').andCallThrough();
            spyOn(registerview, 'onRegistrationFields').andCallThrough();
            spyOn(registerview, 'renderRegistrationForm').andCallThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(converse.connection, 'connect').andCallThrough();

            expect(registerview._registering).toBeFalsy();
            expect(converse.connection.connected).toBeFalsy();
            registerview.$('input[name=domain]').val('conversejs.org');
            registerview.$('input[type=submit]').click();
            expect(registerview.onProviderChosen).toHaveBeenCalled();
            expect(registerview._registering).toBeTruthy();
            expect(converse.connection.connect).toHaveBeenCalled();

            var stanza = new Strophe.Builder("stream:features", {
                        'xmlns:stream': "http://etherx.jabber.org/streams",
                        'xmlns': "jabber:client"
                    })
                .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
                .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
            converse.connection._connect_cb(test_utils.createRequest(stanza));

            expect(registerview.getRegistrationFields).toHaveBeenCalled();
            expect(converse.connection.connected).toBeTruthy();

            stanza = $iq({
                    'type': 'result',
                    'id': 'reg1'
                }).c('query', {'xmlns': 'jabber:iq:register'})
                    .c('instructions')
                        .t('Please choose a username, password and provide your email address').up()
                    .c('username').up()
                    .c('password').up()
                    .c('email');
            converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(registerview.onRegistrationFields).toHaveBeenCalled();
            expect(registerview.renderRegistrationForm).toHaveBeenCalled();
            expect(registerview.$('input').length).toBe(5);
            expect(registerview.$('input[type=submit]').length).toBe(1);
            expect(registerview.$('input[type=button]').length).toBe(1);
        }, { auto_login: false,
              allow_registration: true,
            }));

        it("will set form_type to legacy and submit it as legacy", mock.initConverse(function (converse) {
            var cbview = converse.chatboxviews.get('controlbox');
            cbview.$('#controlbox-tabs').find('li').last().find('a').click(); // Click the Register tab
            var registerview = converse.chatboxviews.get('controlbox').registerpanel;
            spyOn(registerview, 'onProviderChosen').andCallThrough();
            spyOn(registerview, 'getRegistrationFields').andCallThrough();
            spyOn(registerview, 'onRegistrationFields').andCallThrough();
            spyOn(registerview, 'renderRegistrationForm').andCallThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(converse.connection, 'connect').andCallThrough();

            registerview.$('input[name=domain]').val('conversejs.org');
            registerview.$('input[type=submit]').click();

            var stanza = new Strophe.Builder("stream:features", {
                        'xmlns:stream': "http://etherx.jabber.org/streams",
                        'xmlns': "jabber:client"
                    })
                .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
                .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
            converse.connection._connect_cb(test_utils.createRequest(stanza));
            stanza = $iq({
                    'type': 'result',
                    'id': 'reg1'
                }).c('query', {'xmlns': 'jabber:iq:register'})
                    .c('instructions')
                        .t('Please choose a username, password and provide your email address').up()
                    .c('username').up()
                    .c('password').up()
                    .c('email');
            converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(registerview.form_type).toBe('legacy');

            registerview.$('input[name=username]').val('testusername');
            registerview.$('input[name=password]').val('testpassword');
            registerview.$('input[name=email]').val('test@email.local');

            spyOn(converse.connection, 'send');

            registerview.$('input[type=submit]').click();

            expect(converse.connection.send).toHaveBeenCalled();
            var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
            expect($stanza.children('query').children().length).toBe(3);
            expect($stanza.children('query').children()[0].tagName).toBe('username');
        }, { auto_login: false,
              allow_registration: true,
            }));

        it("will set form_type to xform and submit it as xform", mock.initConverse(function (converse) {
            var cbview = converse.chatboxviews.get('controlbox');
            cbview.$('#controlbox-tabs').find('li').last().find('a').click(); // Click the Register tab
            var registerview = converse.chatboxviews.get('controlbox').registerpanel;
            spyOn(registerview, 'onProviderChosen').andCallThrough();
            spyOn(registerview, 'getRegistrationFields').andCallThrough();
            spyOn(registerview, 'onRegistrationFields').andCallThrough();
            spyOn(registerview, 'renderRegistrationForm').andCallThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(converse.connection, 'connect').andCallThrough();

            registerview.$('input[name=domain]').val('conversejs.org');
            registerview.$('input[type=submit]').click();

            var stanza = new Strophe.Builder("stream:features", {
                        'xmlns:stream': "http://etherx.jabber.org/streams",
                        'xmlns': "jabber:client"
                    })
                .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
                .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
            converse.connection._connect_cb(test_utils.createRequest(stanza));
            stanza = $iq({
                    'type': 'result',
                    'id': 'reg1'
                }).c('query', {'xmlns': 'jabber:iq:register'})
                    .c('instructions')
                        .t('Using xform data').up()
                    .c('x', { 'xmlns': 'jabber:x:data', 'type': 'form' })
                        .c('instructions').t('xform instructions').up()
                        .c('field', {'type': 'text-single', 'var': 'username'}).c('required').up().up()
                        .c('field', {'type': 'text-private', 'var': 'password'}).c('required').up().up()
                        .c('field', {'type': 'text-single', 'var': 'email'}).c('required').up().up();
            converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(registerview.form_type).toBe('xform');

            registerview.$('input[name=username]').val('testusername');
            registerview.$('input[name=password]').val('testpassword');
            registerview.$('input[name=email]').val('test@email.local');

            spyOn(converse.connection, 'send');

            registerview.$('input[type=submit]').click();

            expect(converse.connection.send).toHaveBeenCalled();
            var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
            expect($stanza.children('query').children().length).toBe(1);
            expect($stanza.children('query').children().children().length).toBe(3);
            expect($stanza.children('query').children().children()[0].tagName).toBe('field');
        }, { auto_login: false,
              allow_registration: true,
            }));
    });
}));
